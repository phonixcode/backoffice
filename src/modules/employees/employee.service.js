const mongoose = require("mongoose");
const Employee = require("./employee.model");
const User = require("../users/user.model");
const Department = require("../departments/department.model");
const RefreshToken = require("../auth/refreshToken.model");
const { paginate, paginationMeta } = require("../../utils/paginate");
const outboxService = require("../outbox/outbox.service");
const outboxPublisher = require("../outbox/outbox.publisher");
const { isoDate } = require("../../utils/formatters");

const TERMINATION_REASON_LABELS = {
  resignation: "Resignation",
  dismissal: "Dismissal",
  redundancy: "Redundancy",
  end_of_contract: "End of contract",
  retirement: "Retirement",
  other: "Other",
};

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

    const user = await User.findById(userId)
      .select("firstName lastName email isActive")
      .lean();
    if (!user) throw httpError("User not found", 404);
    if (!user.isActive) throw httpError("User account is inactive", 400);

    const existing = await Employee.exists({ user: userId });
    if (existing) {
      throw httpError("Employee profile already exists for this user", 409);
    }

    let department = null;
    if (rest.department) {
      department = await Department.findOne({ _id: rest.department, isActive: true })
        .select("displayName")
        .lean();
      if (!department) throw httpError("Department not found or inactive", 400);
    }

    if (rest.manager) {
      const manager = await Employee.exists({ _id: rest.manager, isActive: true });
      if (!manager) throw httpError("Manager not found or inactive", 400);
    }

    let employee;
    let deliveryIds;
    await mongoose.connection.transaction(async (session) => {
      [employee] = await Employee.create([{ user: userId, ...rest }], { session });
      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `employee:${employee._id}:created:email:welcome`,
          eventType: "employee.created",
          channel: "email",
          aggregate: { type: "employee", id: employee._id },
          payload: {
            type: "welcome",
            data: {
              to: user.email,
              firstName: user.firstName,
              fullName: `${user.firstName} ${user.lastName}`,
              employeeId: employee.employeeId,
              department: department?.displayName || "N/A",
              jobTitle: employee.jobTitle,
              email: user.email,
              startDate: employee.startDate,
            },
          },
        },
      ], session);
    });
    outboxPublisher.kick();

    return { employee, deliveryIds };
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

  async terminateEmployee(employeeId, command, terminatedBy) {
    const employee = await Employee.findById(employeeId)
      .populate("user", "firstName lastName email")
      .populate("department", "displayName")
      .lean();
    if (!employee) throw httpError("Employee not found", 404);
    if (employee.employmentStatus === "terminated") {
      throw httpError("Employee is already terminated", 409);
    }
    if (!employee.user) throw httpError("Linked user account not found", 409);

    const effectiveDate = command.endDate || new Date();
    if (effectiveDate < employee.startDate) {
      throw httpError("End date cannot be before the employment start date", 400);
    }

    const user = employee.user;
    const fullName = `${user.firstName} ${user.lastName}`;
    const deliveryPrefix = `employee:${employee._id}:terminated`;
    let deliveryIds;

    await mongoose.connection.transaction(async (session) => {
      const updated = await Employee.findOneAndUpdate(
        { _id: employee._id, employmentStatus: { $ne: "terminated" } },
        {
          $set: {
            employmentStatus: "terminated",
            endDate: effectiveDate,
            isActive: false,
            termination: {
              reason: command.reason,
              note: command.note,
              effectiveDate,
              recordedBy: terminatedBy,
              recordedAt: new Date(),
            },
          },
        },
        { session, new: true },
      );
      if (!updated) throw httpError("Employee is already terminated", 409);

      const userUpdate = await User.updateOne(
        { _id: user._id },
        { $set: { isActive: false }, $inc: { tokenVersion: 1, sessionEpoch: 1 } },
        { session },
      );
      if (userUpdate.matchedCount !== 1) {
        throw httpError("Linked user account not found", 409);
      }

      await RefreshToken.deleteMany({ userId: user._id }, { session });

      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `${deliveryPrefix}:notification:hr_manager`,
          eventType: "employee.terminated",
          channel: "notification",
          aggregate: { type: "employee", id: employee._id },
          payload: {
            title: "Employee Terminated",
            message: `${fullName} (${employee.employeeId}) has been terminated effective ${isoDate(effectiveDate)}.`,
            type: "warning",
            triggeredBy: terminatedBy,
            resource: "employees",
            resourceId: employee._id,
            role: "hr_manager",
          },
        },
        {
          deliveryId: `${deliveryPrefix}:email:${user._id}`,
          eventType: "employee.terminated",
          channel: "email",
          aggregate: { type: "employee", id: employee._id },
          payload: {
            type: "termination",
            data: {
              to: user.email,
              firstName: user.firstName,
              employeeId: employee.employeeId,
              department: employee.department?.displayName || "N/A",
              jobTitle: employee.jobTitle,
              endDate: effectiveDate,
              reason: TERMINATION_REASON_LABELS[command.reason],
            },
          },
        },
      ], session);
    });
    outboxPublisher.kick();

    return { employee: await employeeService.getEmployee(employeeId), deliveryIds };
  },
};

module.exports = employeeService;
