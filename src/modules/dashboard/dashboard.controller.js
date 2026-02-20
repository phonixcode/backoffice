const dashboardService = require('./dashboard.service');
const asyncHandler     = require('../../utils/asyncHandler');
const apiResponse      = require('../../utils/apiResponse');

const dashboardController = {
  getOverview: asyncHandler(async (req, res) => {
    const data = await dashboardService.getOverview();
    return apiResponse.success(res, 'Dashboard overview', data);
  }),

  getHRStats: asyncHandler(async (req, res) => {
    const data = await dashboardService.getHRStats();
    return apiResponse.success(res, 'HR statistics', data);
  }),

  getPayrollStats: asyncHandler(async (req, res) => {
    const data = await dashboardService.getPayrollStats();
    return apiResponse.success(res, 'Payroll statistics', data);
  }),

  getLeaveStats: asyncHandler(async (req, res) => {
    const data = await dashboardService.getLeaveStats();
    return apiResponse.success(res, 'Leave statistics', data);
  }),

  getActivityFeed: asyncHandler(async (req, res) => {
    const data = await dashboardService.getActivityFeed();
    return apiResponse.success(res, 'Activity feed', data);
  })
};

module.exports = dashboardController;