const Notification = require("./notification.model");
const { sseManager } = require("./sse.manager");

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
  }) {
    const notification = await Notification.create({
      title,
      message,
      type,
      triggeredBy,
      resource,
      resourceId,
      userId,
      role,
      broadcast: broadcast || false,
    });

    // push via SSE immediately after saving
    sseManager.deliver(notification);

    return notification;
  },

  async getForUser(user, query = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = query;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { userId: user._id }, 
        {
          role: {
            $in: user.roles.map(
              (
                r, // role-based
              ) => (typeof r === "object" ? r.name : r),
            ),
          },
        },
        { broadcast: true }, 
      ],
    };

    if (unreadOnly === "true" || unreadOnly === true) {
      filter["readBy.user"] = { $ne: user._id };
    }

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    const userId = user._id.toString();
    const mapped = notifications.map((n) => ({
      ...n,
      isRead: n.readBy.some((r) => r.user.toString() === userId),
    }));

    return {
      notifications: mapped,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },


  async getUnreadCount(user) {
    const filter = {
      $or: [
        { userId: user._id },
        {
          role: {
            $in: user.roles.map((r) => (typeof r === "object" ? r.name : r)),
          },
        },
        { broadcast: true },
      ],
      "readBy.user": { $ne: user._id },
    };

    return Notification.countDocuments(filter);
  },


  async markAsRead(notificationId, userId) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      const error = new Error("Notification not found");
      error.statusCode = 404;
      throw error;
    }

    const alreadyRead = notification.readBy.some(
      (r) => r.user.toString() === userId.toString(),
    );

    if (!alreadyRead) {
      await Notification.findByIdAndUpdate(notificationId, {
        $push: { readBy: { user: userId, readAt: new Date() } },
      });
    }
  },

  async markAllAsRead(user) {
    const filter = {
      $or: [
        { userId: user._id },
        {
          role: {
            $in: user.roles.map((r) => (typeof r === "object" ? r.name : r)),
          },
        },
        { broadcast: true },
      ],
      "readBy.user": { $ne: user._id },
    };

    const unread = await Notification.find(filter).select("_id");

    if (unread.length === 0) return;

    const now = new Date();
    await Notification.updateMany(
      { _id: { $in: unread.map((n) => n._id) } },
      { $push: { readBy: { user: user._id, readAt: now } } },
    );
  },

  async deleteNotification(notificationId) {
    await Notification.findByIdAndDelete(notificationId);
  },
};

module.exports = notificationService;
