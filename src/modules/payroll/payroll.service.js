const mongoose = require("mongoose");
const Payroll = require("./payroll.model");
const Employee = require("../employees/employee.model");
const { paginate, paginationMeta } = require("../../utils/paginate");
const outboxService = require("../outbox/outbox.service");
const outboxPublisher = require("../outbox/outbox.publisher");
const {
  formatPeriod,
  formatCurrency,
  maskAccountNumber,
} = require("../../utils/formatters");

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const sum = (items) => items.reduce((total, item) => total + item.amount, 0);

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
    const { employeeId, month, year, allowances = [], deductions = [], notes } = data;

    const employee = await Employee.findById(employeeId)
      .select("employeeId salary isActive employmentStatus")
      .lean();
    if (!employee) throw httpError("Employee not found", 404);
    if (!employee.isActive || employee.employmentStatus !== "active") {
      throw httpError("Payroll can only be processed for active employees", 409);
    }

    const basicSalary = employee.salary?.amount;
    if (!Number.isFinite(basicSalary) || basicSalary < 0) {
      throw httpError("Employee salary must be a finite nonnegative amount", 409);
    }

    const period = { month, year };
    const existing = await Payroll.exists({
      employee: employeeId,
      "period.month": month,
      "period.year": year,
    });
    if (existing) throw httpError("Payroll already processed for this period", 409);

    const totalAllowances = sum(allowances);
    const totalDeductions = sum(deductions);
    const grossPay = basicSalary + totalAllowances;
    const netPay = grossPay - totalDeductions;
    if (netPay < 0) throw httpError("Total deductions cannot exceed gross pay", 400);

    let payroll;
    let deliveryIds;
    try {
      await mongoose.connection.transaction(async (session) => {
        [payroll] = await Payroll.create([{
          employee: employeeId,
          period,
          basicSalary,
          allowances,
          deductions,
          grossPay,
          netPay,
          currency: employee.salary.currency,
          status: "pending_approval",
          processedBy,
          notes,
        }], { session });

        deliveryIds = await outboxService.enqueue([{
          deliveryId: `payroll:${payroll._id}:processed:notification:finance_manager`,
          eventType: "payroll.processed",
          channel: "notification",
          aggregate: { type: "payroll", id: payroll._id },
          payload: {
            title: "Payroll Processed",
            message: `Payroll for ${employee.employeeId} for ${formatPeriod(period)} has been processed and is pending approval.`,
            type: "info",
            triggeredBy: processedBy,
            resource: "payroll",
            resourceId: payroll._id,
            role: "finance_manager",
          },
        }], session);
      });
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.employee) {
        throw httpError("Payroll already processed for this period", 409);
      }
      throw err;
    }
    outboxPublisher.kick();

    return { payroll, deliveryIds };
  },

  async approvePayroll(payrollId, approvedBy) {
    let deliveryIds;

    await mongoose.connection.transaction(async (session) => {
      const payroll = await Payroll.findOneAndUpdate(
        {
          _id: payrollId,
          status: "pending_approval",
          processedBy: { $ne: approvedBy },
        },
        { $set: { status: "approved", approvedBy, approvedAt: new Date() } },
        { session, new: true },
      );

      if (!payroll) {
        const current = await Payroll.findById(payrollId)
          .select("status processedBy")
          .session(session)
          .lean();
        if (!current) throw httpError("Payroll record not found", 404);
        if (current.status !== "pending_approval") {
          throw httpError(`Cannot approve payroll with status "${current.status}"`, 400);
        }
        throw httpError("You cannot approve payroll that you processed", 403);
      }

      deliveryIds = await outboxService.enqueue([{
        deliveryId: `payroll:${payroll._id}:approved:notification:finance_manager`,
        eventType: "payroll.approved",
        channel: "notification",
        aggregate: { type: "payroll", id: payroll._id },
        payload: {
          title: "Payroll Approved",
          message: `Payroll for ${formatPeriod(payroll.period)} has been approved.`,
          type: "success",
          triggeredBy: approvedBy,
          resource: "payroll",
          resourceId: payroll._id,
          role: "finance_manager",
        },
      }], session);
    });
    outboxPublisher.kick();

    return { payroll: await payrollService.getPayroll(payrollId), deliveryIds };
  },

  async markAsPaid(payrollId, paidBy, { paymentReference, paidAt } = {}) {
    let deliveryIds;

    await mongoose.connection.transaction(async (session) => {
      const payroll = await Payroll.findOneAndUpdate(
        { _id: payrollId, status: "approved" },
        {
          $set: {
            status: "paid",
            paidAt: paidAt || new Date(),
            paidBy,
            ...(paymentReference && { paymentReference }),
          },
        },
        { session, new: true },
      );

      if (!payroll) {
        const exists = await Payroll.exists({ _id: payrollId }).session(session);
        if (!exists) throw httpError("Payroll record not found", 404);
        throw httpError("Only approved payrolls can be marked as paid", 400);
      }

      const employee = await Employee.findById(payroll.employee)
        .select("employeeId user bankDetails")
        .populate("user", "firstName email")
        .session(session)
        .lean();
      if (!employee?.user) {
        deliveryIds = [];
        return;
      }

      const period = formatPeriod(payroll.period);
      const money = (amount) => formatCurrency(amount, payroll.currency);
      const deliveryPrefix = `payroll:${payroll._id}:paid`;

      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `${deliveryPrefix}:notification:${employee.user._id}`,
          eventType: "payroll.payment_recorded",
          channel: "notification",
          aggregate: { type: "payroll", id: payroll._id },
          payload: {
            title: "Salary Payment Recorded",
            message: `A salary payment for ${period} has been recorded.`,
            type: "success",
            triggeredBy: paidBy,
            resource: "payroll",
            resourceId: payroll._id,
            userId: employee.user._id,
          },
        },
        {
          deliveryId: `${deliveryPrefix}:email:${employee.user._id}`,
          eventType: "payroll.payment_recorded",
          channel: "email",
          aggregate: { type: "payroll", id: payroll._id },
          payload: {
            type: "payslip-ready",
            data: {
              to: employee.user.email,
              firstName: employee.user.firstName,
              employeeId: employee.employeeId,
              period,
              basicSalary: money(payroll.basicSalary),
              totalAllowances: money(sum(payroll.allowances)),
              totalDeductions: money(sum(payroll.deductions)),
              grossPay: money(payroll.grossPay),
              netPay: money(payroll.netPay),
              bankName: employee.bankDetails?.bankName,
              accountNumber: maskAccountNumber(employee.bankDetails?.accountNumber),
              paidAt: payroll.paidAt,
              payslipUrl: `${process.env.CLIENT_URL}/payroll/${payroll._id}`,
            },
          },
        },
      ], session);
    });
    outboxPublisher.kick();

    return { payroll: await payrollService.getPayroll(payrollId), deliveryIds };
  },
};

module.exports = payrollService;
