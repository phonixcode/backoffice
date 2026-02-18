const Employee = require('./employee.model');
const User = require('../users/user.model');

const employeeService = {
  async getAllEmployees(query = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      department,
      employmentStatus,
      employmentType
    } = query;

    const filter = { isActive: true };

    if (department) filter.department = department;
    if (employmentStatus) filter.employmentStatus = employmentStatus;
    if (employmentType) filter.employmentType = employmentType;

    // search by employeeId or jobTitle
    if (search) {
      filter.$or = [
        { employeeId: { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Employee.countDocuments(filter);
    const employees = await Employee.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('department', 'name')
      .populate('manager', 'employeeId jobTitle')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return {
      employees,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  },

  async getEmployee(employeeId) {
    const employee = await Employee.findById(employeeId)
      .populate('user', 'firstName lastName email')
      .populate('department', 'name displayName')
      .populate('manager', 'employeeId jobTitle user');

    if (!employee) {
      const error = new Error('Employee not found');
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
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // one employee profile per user
    const existing = await Employee.findOne({ user: userId });
    if (existing) {
      const error = new Error('Employee profile already exists for this user');
      error.statusCode = 409;
      throw error;
    }

    return Employee.create({ user: userId, ...rest });
  },

  async updateEmployee(employeeId, data) {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error('Employee not found');
      error.statusCode = 404;
      throw error;
    }

    const allowedFields = [
      'department', 'jobTitle', 'employmentType',
      'employmentStatus', 'salary', 'phone',
      'address', 'emergencyContact', 'manager', 'endDate'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) employee[field] = data[field];
    });

    await employee.save();
    return employeeService.getEmployee(employeeId);
  },

  async terminateEmployee(employeeId, endDate) {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error('Employee not found');
      error.statusCode = 404;
      throw error;
    }

    employee.employmentStatus = 'terminated';
    employee.endDate = endDate || new Date();
    employee.isActive = false;
    await employee.save();

    await User.findByIdAndUpdate(employee.user, { isActive: false });

    return employeeService.getEmployee(employeeId);
  }
};

module.exports = employeeService;