const Payroll = require("./payroll.model");
const Employee = require("../employees/employee.model");
const { paginate, paginationMeta } = require("../../utils/paginate");
const notificationService = require("../notification/notification.service");

const payrollService = {
  async getAllPayrolls(query = {}) {
    const { page, limit, skip } = paginate(query, 100);

    const filter = {};
    if (query.month) filter["period.month"] = Number(query.month);
    if (query.year) filter["period.year"] = Number(query.year);
    if (query.status) filter.status = query.status;
    if (query.employee) filter.employee = query.employee;

    const [total, payrolls] = await Promise.all([
      Payroll.countDocuments(filter),
      Payroll.find(filter)
        .populate("employee", "employeeId jobTitle user")
        .populate("processedBy", "firstName lastName")
        .populate("approvedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { payrolls, pagination: paginationMeta(total, page, limit) };
  },

  async getPayroll(payrollId) {
    const payroll = await Payroll.findById(payrollId)
      .populate("employee", "employeeId jobTitle user salary")
      .populate("processedBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName");

    if (!payroll) {
      const error = new Error("Payroll record not found");
      error.statusCode = 404;
      throw error;
    }

    return payroll;
  },

  async processPayroll(data, processedBy) {
    const { employeeId, month, year, allowances = [], deductions = [] } = data;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    // check duplicate
    const existing = await Payroll.findOne({
      employee: employeeId,
      "period.month": month,
      "period.year": year,
    });
    if (existing) {
      const error = new Error("Payroll already processed for this period");
      error.statusCode = 409;
      throw error;
    }

    const basicSalary = employee.salary.amount;
    const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const grossPay = basicSalary + totalAllowances;
    const netPay = grossPay - totalDeductions;

    const payroll = await Payroll.create({
      employee: employeeId,
      period: { month, year },
      basicSalary,
      allowances,
      deductions,
      grossPay,
      netPay,
      currency: employee.salary.currency,
      status: "pending_approval",
      processedBy,
    });

    await notificationService.send({
      title:   'Payroll Processed',
      message: `Payroll for ${period.month}/${period.year} has been processed and is pending approval.`,
      type:    'info',
      resource:   'payroll',
      resourceId: payroll._id,
      role:       'finance_manager'
    });

    return payroll;
  },

  async approvePayroll(payrollId, approvedBy) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      const error = new Error("Payroll record not found");
      error.statusCode = 404;
      throw error;
    }

    if (payroll.status !== "pending_approval") {
      const error = new Error(
        `Cannot approve payroll with status "${payroll.status}"`,
      );
      error.statusCode = 400;
      throw error;
    }

    payroll.status = "approved";
    payroll.approvedBy = approvedBy;
    await payroll.save();

    await notificationService.send({
      title:   'Payroll Approved',
      message: `Payroll for ${period.month}/${period.year} has been approved.`,
      type:    'success',
      resource:   'payroll',
      resourceId: payroll._id,
      role:       'finance_manager'
    });

    return payrollService.getPayroll(payrollId);
  },

  async markAsPaid(payrollId) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      const error = new Error("Payroll record not found");
      error.statusCode = 404;
      throw error;
    }

    if (payroll.status !== "approved") {
      const error = new Error("Only approved payrolls can be marked as paid");
      error.statusCode = 400;
      throw error;
    }

    payroll.status = "paid";
    payroll.paidAt = new Date();
    await payroll.save();

    await notificationService.send({
      title:     'Salary Payment',
      message:   `Your salary for ${period.month}/${period.year} has been paid. Check your account.`,
      type:      'success',
      resource:  'payroll',
      broadcast: false,
      userId:    payroll.employee.user
    });

    return payrollService.getPayroll(payrollId);
  },
};

module.exports = payrollService;
