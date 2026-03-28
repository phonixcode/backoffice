const attendanceService = require('./attendance.service');
const Employee          = require('../employees/employee.model');
const asyncHandler      = require('../../utils/asyncHandler');
const apiResponse       = require('../../utils/apiResponse');

const attendanceController = {

  clockIn: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'firstName lastName');

    if (!employee) {
      return apiResponse.error(res, 'Employee profile not found', 404);
    }

    const attendance = await attendanceService.clockIn(
      employee,
      req.body,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    return apiResponse.success(res, { attendance }, 'Clocked in successfully', 201);
  }),

  clockOut: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user._id })
      .populate('user', 'firstName lastName');

    if (!employee) {
      return apiResponse.error(res, 'Employee profile not found', 404);
    }

    const attendance = await attendanceService.clockOut(
      employee,
      req.body,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    return apiResponse.success(res, { attendance }, 'Clocked out successfully');
  }),

  getTodayStatus: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user._id }).lean();
    if (!employee) {
      return apiResponse.error(res, 'Employee profile not found', 404);
    }

    const status = await attendanceService.getTodayStatus(employee._id);
    return apiResponse.success(res, status);
  }),

  getAll: asyncHandler(async (req, res) => {
    const result = await attendanceService.getAll(req.query);
    return apiResponse.success(res, { records: result.records }, 'OK', 200, result.pagination);
  }),

  getMyHistory: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user._id }).lean();
    if (!employee) {
      return apiResponse.error(res, 'Employee profile not found', 404);
    }

    const result = await attendanceService.getAll({
      ...req.query,
      employeeId: employee._id
    });

    return apiResponse.success(res, { records: result.records }, 'OK', 200, result.pagination);
  }),

  getMySummary: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user._id }).lean();
    if (!employee) {
      return apiResponse.error(res, 'Employee profile not found', 404);
    }

    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year  = Number(req.query.year)  || new Date().getFullYear();

    const summary = await attendanceService.getEmployeeSummary(employee._id, month, year);
    return apiResponse.success(res, { summary });
  }),

  getEmployeeSummary: asyncHandler(async (req, res) => {
    const { id }  = req.params;
    const month   = Number(req.query.month) || new Date().getMonth() + 1;
    const year    = Number(req.query.year)  || new Date().getFullYear();

    const summary = await attendanceService.getEmployeeSummary(id, month, year);
    return apiResponse.success(res, { summary });
  }),

  getDepartmentSummary: asyncHandler(async (req, res) => {
    const date   = req.query.date ? new Date(req.query.date) : new Date();
    const summary = await attendanceService.getDepartmentSummary(date);
    return apiResponse.success(res, { summary });
  }),

  getSettings: asyncHandler(async (req, res) => {
    const settings = await attendanceService.getSettings();
    return apiResponse.success(res, { settings });
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await attendanceService.updateSettings(req.body);
    return apiResponse.success(res, { settings }, 'Settings updated');
  })
};

module.exports = attendanceController;