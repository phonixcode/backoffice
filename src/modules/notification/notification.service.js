const Notification = require("./notification.model");
const Role = require("../roles/role.model");
const { sseManager } = require("./sse.manager");
const { paginate, paginationMeta } = require("../../utils/paginate");

function notFound() {
  const error = new Error("Notification not found");
  error.statusCode = 404;
  return error;
}

async function activeRoleNames(user) {
  const roleIds = (user.roles || []).map((r) => (typeof r === "object" && r._id ? r._id : r));
  if (roleIds.length === 0) return [];
  const roles = await Role.find({ _id: { $in: roleIds }, isActive: true })
    .select("name")
    .lean();
  return roles.map((r) => r.name);
}

async function visibilityFilter(user) {
  return {
    $or: [
      { userId: user._id },
      { role: { $in: await activeRoleNames(user) } },
      { broadcast: true },
    ],
  };
}

const notificationService = {
  async send({
    title,
    message,
    type = "info",
    triggeredBy,
    resource,
    resourceId,
    userId,
    role,
    broadcast,
    metadata,
    deliveryId,
  }) {
    const fields = {
      title,
      message,
      type,
      triggeredBy,
      resource,
      resourceId,
      userId,
      role,
      broadcast: broadcast || false,
      metadata,
    };

    let notification;
    if (deliveryId) {
      const result = await Notification.findOneAndUpdate(
        { deliveryId },
        { $setOnInsert: { ...fields, deliveryId } },
        { upsert: true, new: true, includeResultMetadata: true },
      );
      notification = result.value;
      if (result.lastErrorObject?.updatedExisting) return notification;
    } else {
      notification = await Notification.create(fields);
    }

    sseManager.deliver(notification).catch((err) =>
      console.error("SSE delivery failed:", err.message),
    );

    return notification;
  },

  async getForUser(user, query = {}) {
    const { page, limit, skip } = paginate(query, 100);
    const unreadOnly = query.unreadOnly === "true" || query.unreadOnly === true;

    const filter = await visibilityFilter(user);
    if (unreadOnly) {
      filter["readBy.user"] = { $ne: user._id };
    }

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userId = user._id.toString();
    const mapped = notifications.map((n) => ({
      ...n,
      isRead: n.readBy.some((r) => r.user.toString() === userId),
    }));

    return {
      notifications: mapped,
      pagination: paginationMeta(total, page, limit),
    };
  },

  async getUnreadCount(user) {
    const filter = await visibilityFilter(user);
    filter["readBy.user"] = { $ne: user._id };
    return Notification.countDocuments(filter);
  },

  async markAsRead(notificationId, user) {
    const filter = await visibilityFilter(user);
    const visible = await Notification.exists({ _id: notificationId, ...filter });
    if (!visible) throw notFound();

    await Notification.updateOne(
      { _id: notificationId, "readBy.user": { $ne: user._id } },
      { $push: { readBy: { user: user._id, readAt: new Date() } } },
    );
  },

  async markAllAsRead(user) {
    const filter = await visibilityFilter(user);
    filter["readBy.user"] = { $ne: user._id };

    await Notification.updateMany(filter, {
      $push: { readBy: { user: user._id, readAt: new Date() } },
    });
  },

  async deleteNotification(notificationId, user) {
    const notification = await Notification.findOne({
      _id: notificationId,
      ...(await visibilityFilter(user)),
    })
      .select("userId")
      .lean();
    if (!notification) throw notFound();

    if (notification.userId?.toString() !== user._id.toString()) {
      const error = new Error("Shared notifications cannot be deleted");
      error.statusCode = 403;
      throw error;
    }

    await Notification.deleteOne({ _id: notificationId, userId: user._id });
  },
};

module.exports = notificationService;
