const mongoose = require('mongoose');
const connectDB = require('./db');
const User = require('../modules/users/user.model');
const Role = require('../modules/roles/role.model');
const Resource = require('../modules/resources/resource.model');
const Permission = require('../modules/permissions/permission.model');

const DEFAULT_ACTIONS = ['create', 'read', 'update', 'delete', 'list'];

const INITIAL_RESOURCES = [
  { name: 'employees',   displayName: 'Employees',   description: 'Manage company employees' },
  { name: 'departments', displayName: 'Departments', description: 'Manage company departments' },
  { name: 'payroll',     displayName: 'Payroll',     description: 'Manage employee payroll' },
  { name: 'leave',       displayName: 'Leave',       description: 'Manage employee leave requests' },
  { name: 'resources',   displayName: 'Resources',   description: 'Manage system resources' },
  { name: 'roles',       displayName: 'Roles',       description: 'Manage system roles' },
  { name: 'users',       displayName: 'Users',       description: 'Manage system users' },
  { name: 'audit',       displayName: 'Audit Logs',  description: 'View system audit logs' },
];

// custom actions on top of CRUD
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
  ]
};

async function seed() {
  await connectDB();

  console.log('Starting seeder...');

  // clear existing data
  await Promise.all([
    User.deleteMany({}),
    Role.deleteMany({}),
    Resource.deleteMany({}),
    Permission.deleteMany({})
  ]);

  console.log('Cleared existing data');

  // create resources and auto-generate permissions
  const allPermissions = [];

  for (const resourceData of INITIAL_RESOURCES) {
    const resource = await Resource.create(resourceData);

    // standard CRUD permissions
    const crudPermissions = DEFAULT_ACTIONS.map(action => ({
      resource: resource._id,
      resourceName: resource.name,
      action,
      name: `${resource.name}:${action}`,
      type: 'crud',
      description: `${action} ${resource.displayName}`
    }));

    // custom permissions for this resource if any
    const customPermissions = (CUSTOM_ACTIONS[resource.name] || []).map(p => ({
      resource: resource._id,
      resourceName: resource.name,
      action: p.action,
      name: `${resource.name}:${p.action}`,
      type: 'custom',
      description: p.description
    }));

    const created = await Permission.insertMany([...crudPermissions, ...customPermissions]);
    allPermissions.push(...created);

    console.log(`Resource "${resource.name}" created with ${created.length} permissions`);
  }

  // create super admin role with ALL permissions
  const superAdminRole = await Role.create({
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Full system access',
    permissions: allPermissions.map(p => p._id),
    isDefault: false
  });

  // create a basic employee role with minimal permissions
  const employeePermissions = allPermissions.filter(p =>
    (p.resourceName === 'leave' && ['create', 'read', 'list'].includes(p.action)) ||
    (p.resourceName === 'employees' && p.action === 'read')
  );

  await Role.create({
    name: 'employee',
    displayName: 'Employee',
    description: 'Basic employee access',
    permissions: employeePermissions.map(p => p._id),
    isDefault: true 
  });

  console.log('Roles created');

  // create super admin user
  const superAdmin = await User.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@backoffice.com',
    password: 'SuperAdmin@123',
    roles: [superAdminRole._id],
    permissionsCache: allPermissions.map(p => p.name)
  });

  console.log(`Super admin created: ${superAdmin.email}`);
  console.log('Seeding complete!');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeder failed:', err);
  process.exit(1);
});