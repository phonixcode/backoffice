const payrollService = require('./payroll.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const processSchema = Joi.object({
  employeeId: Joi.string().required(),
  month:      Joi.number().min(1).max(12).required(),
  year:       Joi.number().min(2000).required(),
  allowances: Joi.array().items(Joi.object({
    name:   Joi.string().required(),
    amount: Joi.number().required()
  })).optional(),
  deductions: Joi.array().items(Joi.object({
    name:   Joi.string().required(),
    amount: Joi.number().required()
  })).optional(),
  notes: Joi.string().optional()
});

const payrollController = {
  getAll: asyncHandler(async (req, res) => {
    const result = await payrollService.getAllPayrolls(req.query);
    return apiResponse.success(res, 'Payrolls fetched', result);
  }),

  getOne: asyncHandler(async (req, res) => {
    const payroll = await payrollService.getPayroll(req.params.id);
    return apiResponse.success(res, 'Payroll fetched', { payroll });
  }),

  process: asyncHandler(async (req, res) => {
    const { error, value } = processSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const payroll = await payrollService.processPayroll(value, req.user._id);
    return apiResponse.success(res, 'Payroll processed successfully', { payroll }, 201);
  }),

  approve: asyncHandler(async (req, res) => {
    const payroll = await payrollService.approvePayroll(req.params.id, req.user._id);
    return apiResponse.success(res, 'Payroll approved', { payroll });
  }),

  markAsPaid: asyncHandler(async (req, res) => {
    const payroll = await payrollService.markAsPaid(req.params.id);
    return apiResponse.success(res, 'Payroll marked as paid', { payroll });
  })
};

module.exports = payrollController;