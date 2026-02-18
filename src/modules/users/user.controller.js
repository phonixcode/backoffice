const userService = require('./user.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const createSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName:  Joi.string().trim().min(2).max(50).required(),
  email:     Joi.string().email().lowercase().required(),
  password:  Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character'
    }),
  roles: Joi.array().items(Joi.string()).optional()
});

const updateSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName:  Joi.string().trim().min(2).max(50).optional(),
  email:     Joi.string().email().lowercase().optional()
}).min(1);

const assignRolesSchema = Joi.object({
  roles: Joi.array().items(Joi.string()).min(1).required()
});

const directPermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).min(1).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character'
    })
});

const userController = {
  getAll: asyncHandler(async (req, res) => {
    const result = await userService.getAllUsers(req.query);
    return apiResponse.success(res, 'Users fetched', result);
  }),

  getOne: asyncHandler(async (req, res) => {
    const user = await userService.getUser(req.params.id);
    return apiResponse.success(res, 'User fetched', { user });
  }),

  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const user = await userService.createUser(value);
    return apiResponse.success(res, 'User created successfully', { user }, 201);
  }),

  update: asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const user = await userService.updateUser(req.params.id, value);
    return apiResponse.success(res, 'User updated successfully', { user });
  }),

  assignRoles: asyncHandler(async (req, res) => {
    const { error, value } = assignRolesSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const user = await userService.assignRoles(req.params.id, value.roles);
    return apiResponse.success(res, 'Roles assigned successfully', { user });
  }),

  addDirectPermissions: asyncHandler(async (req, res) => {
    const { error, value } = directPermissionsSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const user = await userService.addDirectPermissions(req.params.id, value.permissions);
    return apiResponse.success(res, 'Direct permissions added', { user });
  }),

  removeDirectPermission: asyncHandler(async (req, res) => {
    const user = await userService.removeDirectPermission(
      req.params.id,
      req.params.permissionId
    );
    return apiResponse.success(res, 'Direct permission removed', { user });
  }),

  toggleStatus: asyncHandler(async (req, res) => {
    const result = await userService.toggleUserStatus(req.params.id);
    return apiResponse.success(res, result.message, { isActive: result.isActive });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    await userService.changePassword(
      req.user._id,
      value.currentPassword,
      value.newPassword
    );
    return apiResponse.success(res, 'Password changed successfully. Please login again.');
  })
};

module.exports = userController;