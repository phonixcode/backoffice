const { paginate, paginationMeta } = require("../../utils/paginate");
const AuditLog = require("./auditLog.model");
const suspiciousActivityService = require("./suspiciousActivity.service");

const { redactSensitive, redactUrl } = require('../../utils/redactSensitive');

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
          url: redactUrl(request.originalUrl),
          body: redactSensitive(request.body),
          params: redactSensitive(request.params),
          query: redactSensitive(request.query),
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
    const { page, limit, skip } = paginate(query, 50);

    const filter = {};
    if (query.userId) filter["performedBy.userId"] = query.userId;
    if (query.resource) filter.resource = query.resource;
    if (query.status) filter.status = query.status;
    if (query.country) filter["location.country"] = query.country;
    if (query.ip) filter["location.ip"] = query.ip;

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { logs, pagination: paginationMeta(total, page, limit) };
  },

  async getSuspiciousActivity(query = {}) {
    const { page, limit, skip } = paginate(query, 50);

    const filter = { isSuspicious: true };

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { logs, pagination: paginationMeta(total, page, limit) };
  },

  async getUserActivity(userId, query = {}) {
    return this.getLogs({ ...query, userId });
  },

  async getResourceActivity(resource, query = {}) {
    return this.getLogs({ ...query, resource });
  },
};

module.exports = auditService;
