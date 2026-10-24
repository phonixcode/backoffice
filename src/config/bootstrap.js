const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const Role = require('../modules/roles/role.model');
const Resource = require('../modules/resources/resource.model');
const Permission = require('../modules/permissions/permission.model');

const DEFAULT_ACTIONS = ['create', 'read', 'update', 'delete', 'list'];
const MIN_ADMIN_PASSWORD_LENGTH = 12;

const INITIAL_RESOURCES = [
  { name: 'employees',   displayName: 'Employees',   description: 'Manage company employees' },
  { name: 'departments', displayName: 'Departments', description: 'Manage company departments' },
  { name: 'payroll',     displayName: 'Payroll',     description: 'Manage employee payroll' },
  { name: 'leave',       displayName: 'Leave',       description: 'Manage employee leave requests' },
  { name: 'resources',   displayName: 'Resources',   description: 'Manage system resources' },
  { name: 'roles',       displayName: 'Roles',       description: 'Manage system roles' },
  { name: 'users',       displayName: 'Users',       description: 'Manage system users' },
  { name: 'audit',       displayName: 'Audit Logs',  description: 'View system audit logs' },
  { name: 'dashboard',   displayName: 'Dashboard',   description: 'View dashboard statistics', isSystem: true },
  { name: 'attendance',  displayName: 'Attendance',  description: 'Manage employee attendance' }
];

const CUSTOM_ACTIONS = {
  payroll: [
    { action: 'process',  description: 'Process payroll for a period' },
    { action: 'approve',  description: 'Approve a payroll run' },
  ],
  leave: [
    { action: 'approve',  description: 'Approve a leave request' },
    { action: 'reject',   description: 'Reject a leave request' },
    { action: 'cancel',   description: 'Cancel a leave request' }
  ],
  employees: [
    { action: 'terminate', description: 'Terminate an employee' }
  ],
  attendance: [
    { action: 'export',  description: 'Export employee attendance data' },
  ]
};

const EMPLOYEE_ROLE_PERMISSIONS = ['leave:create', 'leave:read', 'leave:list', 'leave:cancel', 'employees:read'];

class BootstrapError extends Error {}

function readAdminInput(env = process.env) {
  if (!env.BOOTSTRAP_ADMIN_EMAIL) return null;
  let password;
  if (env.BOOTSTRAP_ADMIN_PASSWORD_FILE) {
    try {
      password = fs.readFileSync(env.BOOTSTRAP_ADMIN_PASSWORD_FILE, 'utf8').trim();
    } catch {
      throw new BootstrapError('BOOTSTRAP_ADMIN_PASSWORD_FILE could not be read');
    }
  }
  return {
    email: env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
    firstName: env.BOOTSTRAP_ADMIN_FIRST_NAME,
    lastName: env.BOOTSTRAP_ADMIN_LAST_NAME,
    password
  };
}

function validateAdminInput(admin) {
  const missing = ['email', 'firstName', 'lastName', 'password'].filter(key => !admin?.[key]);
  if (missing.length) {
    throw new BootstrapError(
      'No administrator exists. Provide BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_FIRST_NAME, '
      + 'BOOTSTRAP_ADMIN_LAST_NAME and BOOTSTRAP_ADMIN_PASSWORD_FILE'
    );
  }
  if (admin.password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new BootstrapError(`Administrator password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }
}

function permissionDefinitions(resource) {
  const crud = DEFAULT_ACTIONS.map(action => ({
    action, type: 'crud', description: `${action} ${resource.displayName}`
  }));
  const custom = (CUSTOM_ACTIONS[resource.name] || []).map(p => ({ ...p, type: 'custom' }));
  return [...crud, ...custom];
}

async function administratorExists() {
  const role = await Role.findOne({ name: 'super_admin' }).select('_id').lean();
  return Boolean(role && await User.exists({ roles: role._id }));
}

async function runBootstrap({ admin } = {}) {
  const adminExists = await administratorExists();
  if (!adminExists) {
    validateAdminInput(admin);
    if (await User.exists({ email: admin.email })) {
      throw new BootstrapError('An account with BOOTSTRAP_ADMIN_EMAIL already exists; assign roles to it instead');
    }
  }

  const summary = { createdAdmin: false, resources: 0, permissions: 0 };

  await mongoose.connection.transaction(async (session) => {
    for (const resourceData of INITIAL_RESOURCES) {
      const created = await Resource.updateOne(
        { name: resourceData.name },
        { $setOnInsert: resourceData },
        { upsert: true, session }
      );
      summary.resources += created.upsertedCount;

      const resource = await Resource.findOne({ name: resourceData.name }).session(session).lean();
      for (const def of permissionDefinitions(resourceData)) {
        const name = `${resource.name}:${def.action}`;
        const result = await Permission.updateOne(
          { name },
          { $setOnInsert: { ...def, name, resource: resource._id, resourceName: resource.name } },
          { upsert: true, session }
        );
        summary.permissions += result.upsertedCount;
      }
    }

    const names = INITIAL_RESOURCES.flatMap(r => permissionDefinitions(r).map(d => `${r.name}:${d.action}`));
    const permissions = await Permission.find({ name: { $in: names } }).select('_id name').session(session).lean();

    const superAdminRole = await Role.findOneAndUpdate(
      { name: 'super_admin' },
      {
        $setOnInsert: { displayName: 'Super Admin', description: 'Full system access', isDefault: false },
        $addToSet: { permissions: { $each: permissions.map(p => p._id) } }
      },
      { upsert: true, new: true, session }
    );

    const hasDefaultRole = await Role.exists({ isDefault: true }).session(session);
    await Role.updateOne(
      { name: 'employee' },
      {
        $setOnInsert: {
          displayName: 'Employee',
          description: 'Basic employee access',
          permissions: permissions.filter(p => EMPLOYEE_ROLE_PERMISSIONS.includes(p.name)).map(p => p._id),
          isDefault: !hasDefaultRole
        }
      },
      { upsert: true, session }
    );

    const rolePermissions = await Permission.find({ _id: { $in: superAdminRole.permissions }, isActive: true })
      .select('name').session(session).lean();
    const permissionNames = rolePermissions.map(p => p.name);

    await User.updateMany(
      { roles: superAdminRole._id },
      { $addToSet: { permissionsCache: { $each: permissionNames } } },
      { session }
    );

    if (!adminExists) {
      await User.create([{
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        password: admin.password,
        roles: [superAdminRole._id],
        permissionsCache: permissionNames
      }], { session });
      summary.createdAdmin = true;
    }
  });

  return summary;
}

async function grantEmployeeLeaveCancel() {
  let updatedUsers = 0;
  await mongoose.connection.transaction(async (session) => {
    const permission = await Permission.findOne({ name: 'leave:cancel', isActive: true }).session(session).lean();
    const role = await Role.findOne({ name: 'employee' }).session(session).lean();
    if (!permission || !role) throw new BootstrapError('Run bootstrap first: employee role or leave:cancel permission is missing');

    await Role.updateOne({ _id: role._id }, { $addToSet: { permissions: permission._id } }, { session });
    if (role.isActive === false) return;
    const result = await User.updateMany(
      { roles: role._id },
      { $addToSet: { permissionsCache: permission.name } },
      { session }
    );
    updatedUsers = result.modifiedCount;
  });
  return { updatedUsers };
}

module.exports = { runBootstrap, grantEmployeeLeaveCancel, readAdminInput, BootstrapError, INITIAL_RESOURCES };
