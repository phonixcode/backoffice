const employeeService = require('./employee.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createSchema = Joi.object({
  userId:         objectId.required(),
  department:     objectId.optional(),
  jobTitle:       Joi.string().required(),
  employmentType: Joi.string().valid('full_time', 'part_time', 'contract', 'intern').optional(),
  startDate:      Joi.date().required(),
  salary: Joi.object({
    amount:    Joi.number().required(),
    currency:  Joi.string().optional(),
    frequency: Joi.string().valid('monthly', 'weekly', 'biweekly').optional()
  }).required(),
  phone:   Joi.string().optional(),
  manager: objectId.optional(),
  address: Joi.object({
    street:  Joi.string().optional(),
    city:    Joi.string().optional(),
    state:   Joi.string().optional(),
    country: Joi.string().optional(),
    zipCode: Joi.string().optional()
  }).optional(),
  emergencyContact: Joi.object({
    name:         Joi.string().optional(),
    relationship: Joi.string().optional(),
    phone:        Joi.string().optional()
  }).optional()
});

const updateSchema = Joi.object({
  department:       Joi.string().optional(),
  jobTitle:         Joi.string().optional(),
  employmentType:   Joi.string().valid('full_time', 'part_time', 'contract', 'intern').optional(),
  employmentStatus: Joi.string().valid('active', 'suspended', 'resigned').optional(),
  salary: Joi.object({
    amount:    Joi.number().optional(),
    currency:  Joi.string().optional(),
    frequency: Joi.string().valid('monthly', 'weekly', 'biweekly').optional()
  }).optional(),
  phone:   Joi.string().optional(),
  manager: Joi.string().optional(),
  endDate: Joi.date().optional(),
  address: Joi.object({
    street:  Joi.string().optional(),
    city:    Joi.string().optional(),
    state:   Joi.string().optional(),
    country: Joi.string().optional(),
    zipCode: Joi.string().optional()
  }).optional(),
  emergencyContact: Joi.object({
    name:         Joi.string().optional(),
    relationship: Joi.string().optional(),
    phone:        Joi.string().optional()
  }).optional()
}).min(1);

const terminateSchema = Joi.object({
  endDate: Joi.date().iso().max('now').optional()
    .messages({ 'date.max': 'Scheduled terminations are not supported; "endDate" must not be in the future' }),
  reason:  Joi.string().valid('resignation', 'dismissal', 'redundancy', 'end_of_contract', 'retirement', 'other').optional(),
  note:    Joi.string().trim().max(500).optional()
});

const employeeController = {
  getAll: asyncHandler(async (req, res) => {
    const result = await employeeService.getAllEmployees(req.query);
    return apiResponse.success(res, 'Employees fetched', result);
  }),

  getOne: asyncHandler(async (req, res) => {
    const employee = await employeeService.getEmployee(req.params.id);
    return apiResponse.success(res, 'Employee fetched', { employee });
  }),

  create: asyncHandler(async (req, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { employee, deliveryIds } = await employeeService.createEmployee(value);
    return apiResponse.success(res, 'Employee created successfully', {
      employee,
      delivery: { status: 'queued', deliveryIds }
    }, 201);
  }),

  update: asyncHandler(async (req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const employee = await employeeService.updateEmployee(req.params.id, value);
    return apiResponse.success(res, 'Employee updated successfully', { employee });
  }),

  terminate: asyncHandler(async (req, res) => {
    const { error, value } = terminateSchema.validate(req.body || {});
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const { employee, deliveryIds } = await employeeService.terminateEmployee(
      req.params.id,
      value,
      req.user._id
    );
    return apiResponse.success(res, 'Employee terminated', {
      employee,
      delivery: { status: 'queued', deliveryIds }
    });
  })
};

module.exports = employeeController;