const Payroll = require('./payroll.model');
const Employee = require('../employees/employee.model');

const payrollService = {
  async getAllPayrolls(query = {}) {
    const { page = 1, limit = 10, month, year, status, employee } = query;

    const filter = {};
    if (month)    filter['period.month'] = Number(month);
    if (year)     filter['period.year']  = Number(year);
    if (status)   filter.status = status;
    if (employee) filter.employee = employee;

    const total = await Payroll.countDocuments(filter);
    const payrolls = await Payroll.find(filter)
      .populate('employee', 'employeeId jobTitle user')
      .populate('processedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return {
      payrolls,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };
  },

  async getPayroll(payrollId) {
    const payroll = await Payroll.findById(payrollId)
      .populate('employee', 'employeeId jobTitle user salary')
      .populate('processedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    return payroll;
  },

  async processPayroll(data, processedBy) {
    const { employeeId, month, year, allowances = [], deductions = [] } = data;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error('Employee not found');
      error.statusCode = 404;
      throw error;
    }

    // check duplicate
    const existing = await Payroll.findOne({
      employee: employeeId,
      'period.month': month,
      'period.year': year
    });
    if (existing) {
      const error = new Error('Payroll already processed for this period');
      error.statusCode = 409;
      throw error;
    }

    const basicSalary = employee.salary.amount;
    const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const grossPay = basicSalary + totalAllowances;
    const netPay = grossPay - totalDeductions;

    return Payroll.create({
      employee: employeeId,
      period: { month, year },
      basicSalary,
      allowances,
      deductions,
      grossPay,
      netPay,
      currency: employee.salary.currency,
      status: 'pending_approval',
      processedBy
    });
  },

  async approvePayroll(payrollId, approvedBy) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    if (payroll.status !== 'pending_approval') {
      const error = new Error(`Cannot approve payroll with status "${payroll.status}"`);
      error.statusCode = 400;
      throw error;
    }

    payroll.status = 'approved';
    payroll.approvedBy = approvedBy;
    await payroll.save();

    return payrollService.getPayroll(payrollId);
  },

  async markAsPaid(payrollId) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      const error = new Error('Payroll record not found');
      error.statusCode = 404;
      throw error;
    }

    if (payroll.status !== 'approved') {
      const error = new Error('Only approved payrolls can be marked as paid');
      error.statusCode = 400;
      throw error;
    }

    payroll.status = 'paid';
    payroll.paidAt = new Date();
    await payroll.save();

    return payrollService.getPayroll(payrollId);
  }
};

module.exports = payrollService;