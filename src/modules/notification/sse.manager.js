/**
 * SSE Manager — manages all active SSE connections
 * When a notification is created it delivers to all
 * relevant connected clients instantly
 */

class SSEManager {
  constructor() {
    this.clients = new Map();
  }

  addClient(userId, res) {
    const id = userId.toString();
    if (!this.clients.has(id)) {
      this.clients.set(id, new Set());
    }
    this.clients.get(id).add(res);
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
    console.log(`SSE client disconnected: ${id}`);
  }

  deliver(notification) {
    const payload = JSON.stringify({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      resource: notification.resource,
      resourceId: notification.resourceId,
      createdAt: notification.createdAt,
    });

    let deliveredTo = 0;

    this.clients.forEach((connections, userId) => {
      if (this.shouldDeliver(notification, userId)) {
        connections.forEach((res) => {
          this.sendEvent(res, "notification", payload);
        });
        deliveredTo++;
      }
    });

    console.log(
      `SSE notification delivered to ${deliveredTo} connected user(s)`,
    );
  }

  // check if this notification should go to this user
  shouldDeliver(notification, userId) {
    // broadcast — everyone gets it
    if (notification.broadcast) return true;

    // personal notification
    if (notification.userId && notification.userId.toString() === userId)
      return true;

    if (notification.role) return true;

    return false;
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
      connections.forEach((res) => {
        try {
          res.write(": heartbeat\n\n");
        } catch (err) {
          console.error("SSE heartbeat error:", err.message);
        }
      });
    });
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

setInterval(() => sseManager.heartbeat(), 30000);

module.exports = { sseManager };
