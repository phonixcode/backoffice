const departmentService = require('./department.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const createSchema = Joi.object({
  name:             Joi.string().trim().min(2).max(50).required(),
  displayName:      Joi.string().trim().min(2).max(50).required(),
  description:      Joi.string().trim().optional(),
  head:             Joi.string().optional(),
  parentDepartment: Joi.string().optional()
});

const updateSchema = Joi.object({
  displayName:      Joi.string().trim().min(2).max(50).optional(),
  description:      Joi.string().trim().optional(),
  head:             Joi.string().optional(),
  parentDepartment: Joi.string().optional()
}).min(1);

const departmentController = {
  getAll: asyncHandler(async (req, res) => {
    const departments = await departmentService.getAllDepartments();
    return apiResponse.success(res, 'Departments fetched', { departments });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await departmentService.getDepartment(req.params.id);
    return apiResponse.success(res, 'Department fetched', data);
  }),

  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const department = await departmentService.createDepartment(value);
    return apiResponse.success(res, 'Department created successfully', { department }, 201);
  }),

  update: asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const data = await departmentService.updateDepartment(req.params.id, value);
    return apiResponse.success(res, 'Department updated successfully', data);
  }),

  delete: asyncHandler(async (req, res) => {
    await departmentService.deleteDepartment(req.params.id);
    return apiResponse.success(res, 'Department deleted successfully');
  })
};

module.exports = departmentController;