const AuditLog = require("./auditLog.model");
const suspiciousActivityService = require("./suspiciousActivity.service");

const SENSITIVE_FIELDS = [
  "password",
  "confirmPassword",
  "token",
  "refreshToken",
];

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const sanitized = { ...body };
  SENSITIVE_FIELDS.forEach((field) => {
    if (sanitized[field]) sanitized[field] = "***REDACTED***";
  });
  return sanitized;
}

const auditService = {
  async log({
    performedBy,
    action,
    resource,
    permission,
    request,
    response,
    status,
    device,
    location,
    metadata,
  }) {
    try {
      // save the log entry first
      const logEntry = await AuditLog.create({
        performedBy: performedBy
          ? {
              userId: performedBy._id,
              email: performedBy.email,
              fullName: `${performedBy.firstName} ${performedBy.lastName}`,
            }
          : null,
        action,
        resource,
        permission,
        request: {
          method: request.method,
          url: request.originalUrl,
          body: sanitizeBody(request.body),
          params: request.params,
          query: request.query,
        },
        response,
        device,
        location,
        status,
        metadata,
      });

      // run suspicious activity checks
      suspiciousActivityService
        .analyze({
          performedBy: logEntry.performedBy,
          status: logEntry.status,
          action: logEntry.action,
          resource: logEntry.resource,
        })
        .then(async ({ isSuspicious, reasons }) => {
          if (isSuspicious) {
            await AuditLog.findByIdAndUpdate(logEntry._id, {
              isSuspicious,
              suspiciousReasons: reasons,
            });
          }
        })
        .catch((err) => {
          console.error("Suspicious activity check error:", err.message);
        });
    } catch (err) {
      console.error("Audit log error:", err.message);
    }
  },

  async getLogs(query = {}) {
    const {
      page = 1,
      limit = 20,
      userId,
      resource,
      status,
      country,
      ip,
      startDate,
      endDate,
    } = query;

    const filter = {};

    if (userId) filter["performedBy.userId"] = userId;
    if (resource) filter.resource = resource;
    if (status) filter.status = status;
    if (country) filter["location.country"] = country;
    if (ip) filter["location.ip"] = ip;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    };
  },

  async getUserActivity(userId, query = {}) {
    return auditService.getLogs({ ...query, userId });
  },

  async getResourceActivity(resource, query = {}) {
    return auditService.getLogs({ ...query, resource });
  },

  async getSuspiciousActivity(query = {}) {
    const { page = 1, limit = 20 } = query;

    const filter = { isSuspicious: true };

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return {
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    };
  },
};

module.exports = auditService;
