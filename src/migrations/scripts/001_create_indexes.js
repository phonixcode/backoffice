const mongoose = require('mongoose');

module.exports = {
  async up() {
    const db = mongoose.connection.db;

    // users indexes
    await db.collection('users').createIndexes([
      { key: { email: 1 },            unique: true, name: 'email_unique' },
      { key: { permissionsCache: 1 }, name: 'permissions_cache' },
      { key: { isActive: 1 },         name: 'is_active' },
      { key: { createdAt: -1 },       name: 'created_at_desc' }
    ]);

    // roles indexes
    await db.collection('roles').createIndexes([
      { key: { name: 1 },     unique: true, name: 'role_name_unique' },
      { key: { isActive: 1 }, name: 'is_active' }
    ]);

    // permissions indexes
    await db.collection('permissions').createIndexes([
      { key: { name: 1 },             unique: true, name: 'permission_name_unique' },
      { key: { resource: 1 },         name: 'resource_ref' },
      { key: { resourceName: 1 },     name: 'resource_name' },
      { key: { resource: 1, action: 1 }, unique: true, name: 'resource_action_unique' }
    ]);

    // resources indexes
    await db.collection('resources').createIndexes([
      { key: { name: 1 }, unique: true, name: 'resource_name_unique' }
    ]);

    // employees indexes
    await db.collection('employees').createIndexes([
      { key: { user: 1 },         unique: true, name: 'user_unique' },
      { key: { employeeId: 1 },   unique: true, name: 'employee_id_unique' },
      { key: { department: 1 },   name: 'department_ref' },
      { key: { employmentStatus: 1 }, name: 'employment_status' }
    ]);

    // payroll indexes
    await db.collection('payrolls').createIndexes([
      {
        key: { employee: 1, 'period.month': 1, 'period.year': 1 },
        unique: true,
        name: 'employee_period_unique'
      },
      { key: { status: 1 },    name: 'payroll_status' },
      { key: { 'period.year': 1, 'period.month': 1 }, name: 'period' }
    ]);

    // leave indexes
    await db.collection('leaves').createIndexes([
      { key: { employee: 1, status: 1 }, name: 'employee_status' },
      { key: { startDate: 1, endDate: 1 }, name: 'date_range' },
      { key: { status: 1 }, name: 'leave_status' }
    ]);

    // refreshtokens indexes
    await db.collection('refreshtokens').createIndexes([
      { key: { token: 1 },   unique: true, name: 'token_unique' },
      { key: { userId: 1 },  name: 'user_ref' },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'ttl_expires' }
    ]);

    // auditlogs indexes
    await db.collection('auditlogs').createIndexes([
      { key: { 'performedBy.userId': 1 }, name: 'performed_by' },
      { key: { resource: 1 },             name: 'resource' },
      { key: { status: 1 },               name: 'audit_status' },
      { key: { isSuspicious: 1 },         name: 'is_suspicious' },
      { key: { createdAt: -1 },           name: 'created_at_desc' },
      { key: { createdAt: 1 }, expireAfterSeconds: 365 * 24 * 60 * 60, name: 'ttl_1yr' }
    ]);

    console.log('  → All indexes created');
  }
};