const Department = require('./department.model');
const Employee = require('../employees/employee.model');

const departmentService = {
  async getAllDepartments() {
    return Department.find({ isActive: true })
      .populate('head', 'employeeId jobTitle user')
      .populate('parentDepartment', 'name displayName')
      .sort({ name: 1 });
  },

  async getDepartment(departmentId) {
    const department = await Department.findById(departmentId)
      .populate('head', 'employeeId jobTitle user')
      .populate('parentDepartment', 'name displayName');

    if (!department) {
      const error = new Error('Department not found');
      error.statusCode = 404;
      throw error;
    }

    // get employee count for this department
    const employeeCount = await Employee.countDocuments({
      department: departmentId,
      isActive: true
    });

    return { department, employeeCount };
  },

  async createDepartment(data) {
    const { name, displayName, description, head, parentDepartment } = data;

    const existing = await Department.findOne({ name: name.toLowerCase() });
    if (existing) {
      const error = new Error('Department already exists');
      error.statusCode = 409;
      throw error;
    }

    return Department.create({
      name: name.toLowerCase(),
      displayName,
      description,
      head,
      parentDepartment
    });
  },

  async updateDepartment(departmentId, data) {
    const department = await Department.findById(departmentId);
    if (!department) {
      const error = new Error('Department not found');
      error.statusCode = 404;
      throw error;
    }

    const allowedFields = ['displayName', 'description', 'head', 'parentDepartment'];
    allowedFields.forEach(field => {
      if (data[field] !== undefined) department[field] = data[field];
    });

    await department.save();
    return departmentService.getDepartment(departmentId);
  },

  async deleteDepartment(departmentId) {
    const department = await Department.findById(departmentId);
    if (!department) {
      const error = new Error('Department not found');
      error.statusCode = 404;
      throw error;
    }

    // check if department has active employees
    const employeeCount = await Employee.countDocuments({
      department: departmentId,
      isActive: true
    });

    if (employeeCount > 0) {
      const error = new Error(
        `Cannot delete department with ${employeeCount} active employee(s). Reassign them first.`
      );
      error.statusCode = 400;
      throw error;
    }

    department.isActive = false;
    await department.save();
  }
};

module.exports = departmentService;