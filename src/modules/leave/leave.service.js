const mongoose = require("mongoose");
const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const User = require("../users/user.model");
const Role = require("../roles/role.model");
const { paginate, paginationMeta } = require("../../utils/paginate");
const outboxService = require("../outbox/outbox.service");
const outboxPublisher = require("../outbox/outbox.publisher");

const APPROVER_ROLE = "hr_manager";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isActiveEmployment(employee) {
  return employee.isActive && employee.employmentStatus === "active";
}

async function loadEmployee(filter) {
  return Employee.findOne(filter)
    .select("employeeId user department manager isActive employmentStatus")
    .populate("user", "firstName lastName email")
    .populate("department", "displayName")
    .populate({ path: "manager", select: "user isActive", populate: { path: "user", select: "firstName email isActive" } })
    .lean();
}

async function approverRecipients(employee) {
  const role = await Role.findOne({ name: APPROVER_ROLE, isActive: true }).select("_id").lean();
  const approvers = role
    ? await User.find({ roles: role._id, isActive: true }).select("firstName email").lean()
    : [];

  const manager = employee.manager;
  if (manager?.isActive && manager.user?.isActive) approvers.push(manager.user);

  const requesterId = employee.user._id.toString();
  const unique = new Map();
  approvers.forEach((u) => {
    if (u._id.toString() !== requesterId) unique.set(u._id.toString(), u);
  });
  return [...unique.values()];
}

async function loadForReview(leaveId, reviewedBy) {
  const leave = await Leave.findById(leaveId).select("employee status").lean();
  if (!leave) throw httpError("Leave request not found", 404);

  const [employee, reviewer] = await Promise.all([
    loadEmployee({ _id: leave.employee }),
    User.findById(reviewedBy).select("firstName lastName").lean(),
  ]);
  if (!employee?.user) throw httpError("Employee record for this leave request was not found", 409);
  if (employee.user._id.toString() === reviewedBy.toString()) {
    throw httpError("You cannot review your own leave request", 403);
  }
  return { leave, employee, reviewer };
}

async function transitionFromPending(leaveId, update, action, session) {
  const leave = await Leave.findOneAndUpdate(
    { _id: leaveId, status: "pending" },
    { $set: update },
    { session, new: true },
  );
  if (leave) return leave;

  const current = await Leave.findById(leaveId).select("status").session(session).lean();
  if (!current) throw httpError("Leave request not found", 404);
  throw httpError(`Cannot ${action} leave with status "${current.status}"`, 400);
}

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
    const employee = await loadEmployee({ user: userId });
    if (!employee) throw httpError("Employee profile not found for this user", 404);
    if (!isActiveEmployment(employee)) {
      throw httpError("Only active employees can request leave", 403);
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

    const recipients = await approverRecipients(employee);
    const employeeName = `${employee.user.firstName} ${employee.user.lastName}`;

    let leave;
    let deliveryIds;
    await mongoose.connection.transaction(async (session) => {
      [leave] = await Leave.create([{
        employee: employee._id,
        type,
        startDate,
        endDate,
        reason,
      }], { session });

      const prefix = `leave:${leave._id}:requested`;
      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `${prefix}:notification:${APPROVER_ROLE}`,
          eventType: "leave.requested",
          channel: "notification",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            title: "New Leave Request",
            message: `A new ${leave.type} leave request from ${employeeName} requires your approval.`,
            type: "warning",
            triggeredBy: userId,
            resource: "leave",
            resourceId: leave._id,
            role: APPROVER_ROLE,
          },
        },
        ...recipients.map((recipient) => ({
          deliveryId: `${prefix}:email:${recipient._id}`,
          eventType: "leave.requested",
          channel: "email",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            type: "leave-request",
            data: {
              to: recipient.email,
              recipientName: recipient.firstName,
              employeeName,
              department: employee.department?.displayName || "N/A",
              leaveType: leave.type,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: leave.days,
              reason: leave.reason,
              reviewUrl: `${process.env.CLIENT_URL}/leave/${leave._id}`,
            },
          },
        })),
      ], session);
    });
    outboxPublisher.kick();

    return { leave, deliveryIds };
  },

  async approveLeave(leaveId, reviewedBy, reviewNote) {
    const { employee, reviewer } = await loadForReview(leaveId, reviewedBy);
    if (!isActiveEmployment(employee)) {
      throw httpError("Leave cannot be approved for inactive employment", 409);
    }

    let deliveryIds;
    await mongoose.connection.transaction(async (session) => {
      const leave = await transitionFromPending(leaveId, {
        status: "approved",
        reviewedBy,
        reviewNote,
        reviewedAt: new Date(),
      }, "approve", session);

      const prefix = `leave:${leave._id}:approved`;
      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `${prefix}:notification:${employee.user._id}`,
          eventType: "leave.approved",
          channel: "notification",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            title: "Leave Request Approved",
            message: `Your ${leave.type} leave request from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been approved.`,
            type: "success",
            triggeredBy: reviewedBy,
            resource: "leave",
            resourceId: leave._id,
            userId: employee.user._id,
          },
        },
        {
          deliveryId: `${prefix}:email:${employee.user._id}`,
          eventType: "leave.approved",
          channel: "email",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            type: "leave-approved",
            data: {
              to: employee.user.email,
              firstName: employee.user.firstName,
              leaveType: leave.type,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: leave.days,
              approvedBy: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : "HR",
            },
          },
        },
      ], session);
    });
    outboxPublisher.kick();

    return { leave: await leaveService.getLeave(leaveId), deliveryIds };
  },

  async rejectLeave(leaveId, reviewedBy, reviewNote) {
    if (!reviewNote) {
      throw httpError("Review note is required when rejecting a leave request", 400);
    }
    const { employee, reviewer } = await loadForReview(leaveId, reviewedBy);

    let deliveryIds;
    await mongoose.connection.transaction(async (session) => {
      const leave = await transitionFromPending(leaveId, {
        status: "rejected",
        reviewedBy,
        reviewNote,
        reviewedAt: new Date(),
      }, "reject", session);

      const prefix = `leave:${leave._id}:rejected`;
      deliveryIds = await outboxService.enqueue([
        {
          deliveryId: `${prefix}:notification:${employee.user._id}`,
          eventType: "leave.rejected",
          channel: "notification",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            title: "Leave Request Rejected",
            message: `Your ${leave.type} leave request has been rejected. Reason: ${reviewNote}`,
            type: "error",
            triggeredBy: reviewedBy,
            resource: "leave",
            resourceId: leave._id,
            userId: employee.user._id,
          },
        },
        {
          deliveryId: `${prefix}:email:${employee.user._id}`,
          eventType: "leave.rejected",
          channel: "email",
          aggregate: { type: "leave", id: leave._id },
          payload: {
            type: "leave-rejected",
            data: {
              to: employee.user.email,
              firstName: employee.user.firstName,
              leaveType: leave.type,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: leave.days,
              reviewedBy: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : "HR",
              reviewNote,
            },
          },
        },
      ], session);
    });
    outboxPublisher.kick();

    return { leave: await leaveService.getLeave(leaveId), deliveryIds };
  },

  async cancelLeave(leaveId, userId) {
    const existing = await Leave.findById(leaveId).select("employee").lean();
    if (!existing) throw httpError("Leave request not found", 404);

    const employee = await loadEmployee({ _id: existing.employee });
    if (!employee?.user || employee.user._id.toString() !== userId.toString()) {
      throw httpError("You can only cancel your own leave requests", 403);
    }

    let deliveryIds;
    await mongoose.connection.transaction(async (session) => {
      const leave = await Leave.findOneAndUpdate(
        { _id: leaveId, status: { $in: ["pending", "approved"] } },
        { $set: { status: "cancelled" } },
        { session, new: true },
      );
      if (!leave) {
        const current = await Leave.findById(leaveId).select("status").session(session).lean();
        if (!current) throw httpError("Leave request not found", 404);
        throw httpError(`Cannot cancel leave with status "${current.status}"`, 400);
      }

      deliveryIds = await outboxService.enqueue([{
        deliveryId: `leave:${leave._id}:cancelled:notification:${APPROVER_ROLE}`,
        eventType: "leave.cancelled",
        channel: "notification",
        aggregate: { type: "leave", id: leave._id },
        payload: {
          title: "Leave Request Cancelled",
          message: `${employee.user.firstName} ${employee.user.lastName} cancelled a ${leave.type} leave request.`,
          type: "info",
          triggeredBy: userId,
          resource: "leave",
          resourceId: leave._id,
          role: APPROVER_ROLE,
        },
      }], session);
    });
    outboxPublisher.kick();

    return { leave: await leaveService.getLeave(leaveId), deliveryIds };
  },
};

module.exports = leaveService;
