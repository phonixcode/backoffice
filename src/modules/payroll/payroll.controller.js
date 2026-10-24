const payrollService = require('./payroll.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const adjustment = Joi.object({
  name:   Joi.string().trim().min(1).max(100).required(),
  amount: Joi.number().min(0).required()
});

const processSchema = Joi.object({
  employeeId: Joi.string().hex().length(24).required(),
  month:      Joi.number().integer().min(1).max(12).required(),
  year:       Joi.number().integer().min(2000).max(2100).required(),
  allowances: Joi.array().items(adjustment).max(50).optional(),
  deductions: Joi.array().items(adjustment).max(50).optional(),
  notes: Joi.string().trim().max(1000).optional()
});

const markPaidSchema = Joi.object({
  paymentReference: Joi.string().trim().min(1).max(100).optional(),
  paidAt:           Joi.date().iso().max('now').optional()
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

    const { payroll, deliveryIds } = await payrollService.processPayroll(value, req.user._id);
    return apiResponse.success(res, 'Payroll processed successfully', {
      payroll,
      delivery: { status: 'queued', deliveryIds }
    }, 201);
  }),

  approve: asyncHandler(async (req, res) => {
    const { payroll, deliveryIds } = await payrollService.approvePayroll(req.params.id, req.user._id);
    return apiResponse.success(res, 'Payroll approved', {
      payroll,
      delivery: { status: 'queued', deliveryIds }
    });
  }),

  markAsPaid: asyncHandler(async (req, res) => {
    const { error, value } = markPaidSchema.validate(req.body || {});
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { payroll, deliveryIds } = await payrollService.markAsPaid(req.params.id, req.user._id, value);
    return apiResponse.success(res, 'Payroll marked as paid', {
      payroll,
      delivery: { status: 'queued', deliveryIds }
    });
  })
};

module.exports = payrollController;