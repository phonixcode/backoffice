const roleService = require("./role.service");
const asyncHandler = require("../../utils/asyncHandler");
const apiResponse = require("../../utils/apiResponse");
const Joi = require("joi");
const mongoose = require("mongoose");

const createSchema = Joi.object({
  name: Joi.string().lowercase().trim().min(2).max(50).required(),
  displayName: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().trim().optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  isDefault: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().lowercase().trim().min(2).max(50).optional(),
  displayName: Joi.string().trim().min(2).max(50).optional(),
  description: Joi.string().trim().optional(),
  isDefault: Joi.boolean().optional(),
}).min(1);

const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required(),
});

const roleController = {
  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const role = await roleService.createRole(value);
    return apiResponse.success(res, "Role created successfully", { role }, 201);
  }),

  getAll: asyncHandler(async (req, res) => {
    const roles = await roleService.getAllRoles();
    return apiResponse.success(res, "Roles fetched", { roles });
  }),

  getOne: asyncHandler(async (req, res) => {
    const role = await roleService.getRole(req.params.id);
    return apiResponse.success(res, "Role fetched", { role });
  }),

  update: asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const role = await roleService.updateRole(req.params.id, value);
    return apiResponse.success(res, "Role updated successfully", { role });
  }),

  updatePermissions: asyncHandler(async (req, res) => {
    const { error, value } = updatePermissionsSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const role = await roleService.updateRolePermissions(
      req.params.id,
      value.permissions,
    );
    return apiResponse.success(res, "Role permissions updated", { role });
  }),

  delete: asyncHandler(async (req, res) => {
    await roleService.deleteRole(req.params.id);
    return apiResponse.success(res, "Role deleted successfully");
  }),
};

module.exports = roleController;
