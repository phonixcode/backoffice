const leaveService = require('./leave.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const createSchema = Joi.object({
  type:      Joi.string().valid('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other').required(),
  startDate: Joi.date().iso().required(),
  endDate:   Joi.date().iso().min(Joi.ref('startDate')).required()
    .messages({ 'date.min': '"endDate" must be on or after "startDate"' }),
  reason:    Joi.string().trim().min(10).max(1000).required()
});

const approveSchema = Joi.object({
  reviewNote: Joi.string().trim().max(1000).optional()
});

const rejectSchema = Joi.object({
  reviewNote: Joi.string().trim().min(3).max(1000).required()
});

const leaveController = {
  getAll: asyncHandler(async (req, res) => {
    const result = await leaveService.getAllLeaves(req.query);
    return apiResponse.success(res, 'Leave requests fetched', result);
  }),

  getOne: asyncHandler(async (req, res) => {
    const leave = await leaveService.getLeave(req.params.id);
    return apiResponse.success(res, 'Leave request fetched', { leave });
  }),

  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { leave, deliveryIds } = await leaveService.createLeave(value, req.user._id);
    return apiResponse.success(res, 'Leave request submitted', {
      leave,
      delivery: { status: 'queued', deliveryIds }
    }, 201);
  }),

  approve: asyncHandler(async (req, res) => {
    const { error, value } = approveSchema.validate(req.body || {});
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { leave, deliveryIds } = await leaveService.approveLeave(req.params.id, req.user._id, value.reviewNote);
    return apiResponse.success(res, 'Leave request approved', {
      leave,
      delivery: { status: 'queued', deliveryIds }
    });
  }),

  reject: asyncHandler(async (req, res) => {
    const { error, value } = rejectSchema.validate(req.body || {});
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { leave, deliveryIds } = await leaveService.rejectLeave(req.params.id, req.user._id, value.reviewNote);
    return apiResponse.success(res, 'Leave request rejected', {
      leave,
      delivery: { status: 'queued', deliveryIds }
    });
  }),

  cancel: asyncHandler(async (req, res) => {
    const { leave, deliveryIds } = await leaveService.cancelLeave(req.params.id, req.user._id);
    return apiResponse.success(res, 'Leave request cancelled', {
      leave,
      delivery: { status: 'queued', deliveryIds }
    });
  })
};

module.exports = leaveController;