const exportService = require('./export.service');
const asyncHandler  = require('../../utils/asyncHandler');

const exportController = {
  employees: asyncHandler(async (req, res) => {
    await exportService.streamEmployees(res, req.query);
  }),

  payroll: asyncHandler(async (req, res) => {
    await exportService.streamPayroll(res, req.query);
  }),

  leave: asyncHandler(async (req, res) => {
    await exportService.streamLeave(res, req.query);
  }),

  auditLogs: asyncHandler(async (req, res) => {
    await exportService.streamAuditLogs(res, req.query);
  })
};

module.exports = exportController;