const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const { paginate, paginationMeta } = require("../../utils/paginate");

const leaveService = {
  async getAllLeaves(query = {}) {
    const { page, limit, skip } = paginate(query, 100);

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.employee) filter.employee = query.employee;

    const [total, leaves] = await Promise.all([
      Leave.countDocuments(filter),
      Leave.find(filter)
        .populate("employee", "employeeId jobTitle user")
        .populate("reviewedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { leaves, pagination: paginationMeta(total, page, limit) };
  },

  async getLeave(leaveId) {
    const leave = await Leave.findById(leaveId)
      .populate("employee", "employeeId jobTitle user")
      .populate("reviewedBy", "firstName lastName");

    if (!leave) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    return leave;
  },

  async createLeave(data, userId) {
    const employee = await Employee.findOne({ user: userId });
    if (!employee) {
      const error = new Error("Employee profile not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const { type, startDate, endDate, reason } = data;

    // check for overlapping leave requests
    const overlap = await Leave.findOne({
      employee: employee._id,
      status: { $in: ["pending", "approved"] },
      $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
    });

    if (overlap) {
      const error = new Error(
        "You already have a leave request overlapping these dates",
      );
      error.statusCode = 409;
      throw error;
    }

    return Leave.create({
      employee: employee._id,
      type,
      startDate,
      endDate,
      reason,
    });
  },

  async approveLeave(leaveId, reviewedBy, reviewNote) {
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (leave.status !== "pending") {
      const error = new Error(
        `Cannot approve leave with status "${leave.status}"`,
      );
      error.statusCode = 400;
      throw error;
    }

    leave.status = "approved";
    leave.reviewedBy = reviewedBy;
    leave.reviewNote = reviewNote;
    leave.reviewedAt = new Date();
    await leave.save();

    return leaveService.getLeave(leaveId);
  },

  async rejectLeave(leaveId, reviewedBy, reviewNote) {
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (leave.status !== "pending") {
      const error = new Error(
        `Cannot reject leave with status "${leave.status}"`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (!reviewNote) {
      const error = new Error(
        "Review note is required when rejecting a leave request",
      );
      error.statusCode = 400;
      throw error;
    }

    leave.status = "rejected";
    leave.reviewedBy = reviewedBy;
    leave.reviewNote = reviewNote;
    leave.reviewedAt = new Date();
    await leave.save();

    return leaveService.getLeave(leaveId);
  },

  async cancelLeave(leaveId, userId) {
    const leave = await Leave.findById(leaveId).populate("employee");

    if (!leave) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (leave.employee.user.toString() !== userId.toString()) {
      const error = new Error("You can only cancel your own leave requests");
      error.statusCode = 403;
      throw error;
    }

    if (!["pending", "approved"].includes(leave.status)) {
      const error = new Error(
        `Cannot cancel leave with status "${leave.status}"`,
      );
      error.statusCode = 400;
      throw error;
    }

    leave.status = "cancelled";
    await leave.save();

    return leaveService.getLeave(leaveId);
  },
};

module.exports = leaveService;
