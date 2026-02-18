const leaveService = require('./leave.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const createSchema = Joi.object({
  type:      Joi.string().valid('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other').required(),
  startDate: Joi.date().required(),                              
  endDate:   Joi.date().greater(Joi.ref('startDate')).required(),
  reason:    Joi.string().trim().min(10).required()
});

const reviewSchema = Joi.object({
  reviewNote: Joi.string().trim().optional()
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

    const leave = await leaveService.createLeave(value, req.user._id);
    return apiResponse.success(res, 'Leave request submitted', { leave }, 201);
  }),

  approve: asyncHandler(async (req, res) => {
    const { reviewNote } = req.body;
    const leave = await leaveService.approveLeave(req.params.id, req.user._id, reviewNote);
    return apiResponse.success(res, 'Leave request approved', { leave });
  }),

  reject: asyncHandler(async (req, res) => {
    const { error, value } = reviewSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const leave = await leaveService.rejectLeave(req.params.id, req.user._id, value.reviewNote);
    return apiResponse.success(res, 'Leave request rejected', { leave });
  }),

  cancel: asyncHandler(async (req, res) => {
    const leave = await leaveService.cancelLeave(req.params.id, req.user._id);
    return apiResponse.success(res, 'Leave request cancelled', { leave });
  })
};

module.exports = leaveController;