const AuditLog = require("./auditLog.model");

const SENSITIVE_RESOURCES = ["payroll", "users", "roles", "resources"];
const ODD_HOURS_START = 22; // 10pm
const ODD_HOURS_END = 6; // 6am

const suspiciousActivityService = {
  async analyze(logEntry) {
    const reasons = [];

    const checks = await Promise.all([
      suspiciousActivityService.checkRepeatedForbidden(logEntry),
      suspiciousActivityService.checkHighMutationVolume(logEntry),
      suspiciousActivityService.checkOddHoursAccess(logEntry),
      suspiciousActivityService.checkBulkDeletions(logEntry),
    ]);

    checks.forEach((reason) => {
      if (reason) reasons.push(reason);
    });

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  },

  // Signal 1 — 5+ forbidden attempts within 15 minutes
  async checkRepeatedForbidden(logEntry) {
    if (logEntry.status !== "forbidden") return null;
    if (!logEntry.performedBy?.userId) return null;

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const count = await AuditLog.countDocuments({
      "performedBy.userId": logEntry.performedBy.userId,
      status: "forbidden",
      createdAt: { $gte: fifteenMinutesAgo },
    });

    if (count >= 5) {
      return `Repeated forbidden attempts — ${count} access denied events in the last 15 minutes`;
    }

    return null;
  },

  // Signal 2 — 20+ mutations within 5 minutes
  async checkHighMutationVolume(logEntry) {
    if (!logEntry.performedBy?.userId) return null;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const count = await AuditLog.countDocuments({
      "performedBy.userId": logEntry.performedBy.userId,
      action: { $in: ["POST", "PUT", "PATCH", "DELETE"] },
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (count >= 20) {
      return `High mutation volume — ${count} mutating requests in the last 5 minutes`;
    }

    return null;
  },

  // Signal 3 — sensitive resource access between 10pm and 6am
  checkOddHoursAccess(logEntry) {
    if (!SENSITIVE_RESOURCES.includes(logEntry.resource)) return null;
    if (logEntry.status !== "success") return null;

    const hour = new Date().getHours();
    const isOddHour = hour >= ODD_HOURS_START || hour < ODD_HOURS_END;

    if (isOddHour) {
      return `Sensitive resource "${logEntry.resource}" accessed at odd hours (${hour}:00)`;
    }

    return null;
  },

  // Signal 4 — 5+ deletions within 10 minutes
  async checkBulkDeletions(logEntry) {
    if (logEntry.action !== "DELETE") return null;
    if (!logEntry.performedBy?.userId) return null;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const count = await AuditLog.countDocuments({
      "performedBy.userId": logEntry.performedBy.userId,
      action: "DELETE",
      createdAt: { $gte: tenMinutesAgo },
    });

    if (count >= 5) {
      return `Bulk deletions detected — ${count} delete operations in the last 10 minutes`;
    }

    return null;
  },
};

module.exports = suspiciousActivityService;
