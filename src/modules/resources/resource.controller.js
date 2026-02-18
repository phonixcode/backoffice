const resourceService = require('./resource.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const createSchema = Joi.object({
  name: Joi.string().lowercase().trim().min(2).max(50).required(),
  displayName: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().trim().optional()
});

const customPermissionSchema = Joi.object({
  action: Joi.string().lowercase().trim().min(2).max(50).required(),
  description: Joi.string().trim().optional()
});

const resourceController = {
  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const resource = await resourceService.createResource(value);
    return apiResponse.success(res, 'Resource created successfully', { resource }, 201);
  }),

  getAll: asyncHandler(async (req, res) => {
    const resources = await resourceService.getAllResources();
    return apiResponse.success(res, 'Resources fetched', { resources });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await resourceService.getResourceWithPermissions(req.params.id);
    return apiResponse.success(res, 'Resource fetched', data);
  }),

  addCustomPermission: asyncHandler(async (req, res) => {
    const { error, value } = customPermissionSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const permission = await resourceService.addCustomPermission(
      req.params.id,
      value.action,
      value.description
    );
    return apiResponse.success(res, 'Custom permission added', { permission }, 201);
  }),

  delete: asyncHandler(async (req, res) => {
    await resourceService.deleteResource(req.params.id);
    return apiResponse.success(res, 'Resource deleted successfully');
  })
};

module.exports = resourceController;