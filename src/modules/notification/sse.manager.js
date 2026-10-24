const User = require("../users/user.model");
const Role = require("../roles/role.model");

const HEARTBEAT_MS = 30000;

class SSEManager {
  constructor() {
    this.clients = new Map();
    this.timer = null;
  }

  addClient(userId, res, { tokenVersion, expiresAt } = {}) {
    const id = userId.toString();
    if (!this.clients.has(id)) {
      this.clients.set(id, new Map());
    }
    this.clients.get(id).set(res, { tokenVersion, expiresAt });
    this.startHeartbeat();
    console.log(
      `SSE client connected: ${id} (${this.clients.get(id).size} connections)`,
    );
  }

  removeClient(userId, res) {
    const id = userId.toString();
    if (this.clients.has(id)) {
      this.clients.get(id).delete(res);
      if (this.clients.get(id).size === 0) {
        this.clients.delete(id);
      }
    }
    if (this.clients.size === 0) this.stopHeartbeat();
    console.log(`SSE client disconnected: ${id}`);
  }

  async activeUsers(userIds) {
    if (userIds.length === 0) return new Map();
    const users = await User.find({ _id: { $in: userIds }, isActive: true })
      .select("roles tokenVersion")
      .lean();
    return new Map(users.map((u) => [u._id.toString(), u]));
  }

  isCurrent(connection, user) {
    if (!user || connection.tokenVersion !== user.tokenVersion) return false;
    return !connection.expiresAt || connection.expiresAt > Date.now();
  }

  async deliver(notification) {
    const payload = JSON.stringify({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      resource: notification.resource,
      resourceId: notification.resourceId,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    });

    const users = await this.activeUsers([...this.clients.keys()]);
    let roleId = null;
    if (notification.role) {
      const role = await Role.findOne({ name: notification.role, isActive: true })
        .select("_id")
        .lean();
      if (!role) return 0;
      roleId = role._id.toString();
    }

    let deliveredTo = 0;
    this.clients.forEach((connections, userId) => {
      const user = users.get(userId);
      if (!this.shouldDeliver(notification, userId, user, roleId)) return;
      let sent = false;
      connections.forEach((connection, res) => {
        if (!this.isCurrent(connection, user)) return;
        this.sendEvent(res, "notification", payload);
        sent = true;
      });
      if (sent) deliveredTo++;
    });

    console.log(
      `SSE notification delivered to ${deliveredTo} connected user(s)`,
    );
    return deliveredTo;
  }

  shouldDeliver(notification, userId, user, roleId) {
    if (!user) return false;
    if (notification.broadcast) return true;
    if (notification.userId) return notification.userId.toString() === userId;
    if (roleId) return (user.roles || []).some((r) => r.toString() === roleId);
    return false;
  }

  async revalidate() {
    const users = await this.activeUsers([...this.clients.keys()]);
    this.clients.forEach((connections, userId) => {
      connections.forEach((connection, res) => {
        if (this.isCurrent(connection, users.get(userId))) return;
        this.sendEvent(res, "session_ended", JSON.stringify({ message: "Session ended" }));
        res.end();
        this.removeClient(userId, res);
      });
    });
  }

  sendEvent(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error("SSE write error:", err.message);
    }
  }

  heartbeat() {
    this.clients.forEach((connections) => {
      connections.forEach((connection, res) => {
        try {
          res.write(": heartbeat\n\n");
        } catch (err) {
          console.error("SSE heartbeat error:", err.message);
        }
      });
    });
    this.revalidate().catch((err) =>
      console.error("SSE revalidation error:", err.message),
    );
  }

  startHeartbeat() {
    if (this.timer) return;
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.timer.unref();
  }

  stopHeartbeat() {
    clearInterval(this.timer);
    this.timer = null;
  }

  closeAll() {
    this.clients.forEach((connections) => {
      connections.forEach((connection, res) => res.end());
    });
    this.clients.clear();
    this.stopHeartbeat();
  }

  get connectionCount() {
    let count = 0;
    this.clients.forEach((connections) => {
      count += connections.size;
    });
    return count;
  }
}

const sseManager = new SSEManager();

module.exports = { sseManager };
