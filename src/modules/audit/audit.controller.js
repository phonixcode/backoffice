const auditService = require("./audit.service");
const asyncHandler = require("../../utils/asyncHandler");
const apiResponse = require("../../utils/apiResponse");

const auditController = {
  getLogs: asyncHandler(async (req, res) => {
    const result = await auditService.getLogs(req.query);
    return apiResponse.success(res, "Audit logs fetched", result);
  }),

  getUserActivity: asyncHandler(async (req, res) => {
    const result = await auditService.getUserActivity(
      req.params.userId,
      req.query,
    );
    return apiResponse.success(res, "User activity fetched", result);
  }),

  getResourceActivity: asyncHandler(async (req, res) => {
    const result = await auditService.getResourceActivity(
      req.params.resource,
      req.query,
    );
    return apiResponse.success(res, "Resource activity fetched", result);
  }),

  getSuspiciousActivity: asyncHandler(async (req, res) => {
    const result = await auditService.getSuspiciousActivity(req.query);
    return apiResponse.success(res, "Suspicious activity fetched", result);
  }),
};

module.exports = auditController;
