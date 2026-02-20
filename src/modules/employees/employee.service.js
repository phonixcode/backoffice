const Employee = require("./employee.model");
const User = require("../users/user.model");
const Department = require("../departments/department.model");
const { paginate, paginationMeta } = require("../../utils/paginate");
const notificationService = require("../notification/notification.service");
const { emailQueue } = require("../../jobs/queue");
const { v4: uuidv4 } = require("uuid");

function generateTempPassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '@#$!%*?&';

  const rand = (str) => str[Math.floor(Math.random() * str.length)];

  const password = [
    rand(upper),
    rand(upper),
    rand(lower),
    rand(lower),
    rand(numbers),
    rand(numbers),
    rand(special),
    rand(special)
  ];

  return password.sort(() => Math.random() - 0.5).join('');
}

const employeeService = {
  async getAllEmployees(query = {}) {
    const { page, limit, skip } = paginate(query, 100);

    const filter = { isActive: true };

    if (query.department) filter.department = query.department;
    if (query.employmentStatus)
      filter.employmentStatus = query.employmentStatus;
    if (query.employmentType) filter.employmentType = query.employmentType;

    if (query.search) {
      filter.$or = [
        { employeeId: { $regex: query.search, $options: "i" } },
        { jobTitle: { $regex: query.search, $options: "i" } },
      ];
    }

    const [total, employees] = await Promise.all([
      Employee.countDocuments(filter),
      Employee.find(filter)
        .populate("user", "firstName lastName email")
        .populate("department", "name displayName")
        .populate("manager", "employeeId jobTitle")
        .select("-bankDetails -emergencyContact")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { employees, pagination: paginationMeta(total, page, limit) };
  },

  async getEmployee(employeeId) {
    const employee = await Employee.findById(employeeId)
      .populate("user", "firstName lastName email")
      .populate("department", "name displayName")
      .populate("manager", "employeeId jobTitle user");

    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    return employee;
  },

  async createEmployee(data) {
    const { userId, ...rest } = data;

    // ensure user exists
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // one employee profile per user
    const existing = await Employee.findOne({ user: userId });
    if (existing) {
      const error = new Error("Employee profile already exists for this user");
      error.statusCode = 409;
      throw error;
    }

    const department = await Department.findById(rest.department).lean();

    const tempPassword = generateTempPassword();
    user.password      = tempPassword;
    await user.save();


    const employee = await Employee.create({ user: userId, ...rest });

    await emailQueue.add(
      {
        type: "welcome",
        data: {
          to: user.email,
          firstName: user.firstName,
          fullName: `${user.firstName} ${user.lastName}`,
          employeeId: employee.employeeId,
          department: department?.displayName || "N/A",
          jobTitle: employee.jobTitle,
          email: user.email,
          tempPassword,
          startDate: employee.startDate,
        },
      },
      { jobId: uuidv4() },
    );

    return employee;
  },

  async updateEmployee(employeeId, data) {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    const allowedFields = [
      "department",
      "jobTitle",
      "employmentType",
      "employmentStatus",
      "salary",
      "phone",
      "address",
      "emergencyContact",
      "manager",
      "endDate",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) employee[field] = data[field];
    });

    await employee.save();
    return employeeService.getEmployee(employeeId);
  },

  async terminateEmployee(employeeId, endDate) {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    employee.employmentStatus = "terminated";
    employee.endDate = endDate || new Date();
    employee.isActive = false;
    await employee.save();

    const user = await User.findByIdAndUpdate(employee.user, { isActive: false });

    await notificationService.send({
      title: "Employee Terminated",
      message: `${employee.user.firstName} ${employee.user.lastName} has been terminated.`,
      type: "warning",
      resource: "employees",
      resourceId: employee._id,
      role: "hr_manager",
    });

    await emailQueue.add(
      {
        type: 'termination',
        data: {
          to:          user.email,
          firstName:   user.firstName,
          employeeId:  employee.employeeId,
          department:  department.displayName,
          jobTitle:    employee.jobTitle,
          endDate:     employee.endDate,
          reason:      terminationReason
        }
      },
      { jobId: uuidv4() }
    );

    return employeeService.getEmployee(employeeId);
  },
};

module.exports = employeeService;
