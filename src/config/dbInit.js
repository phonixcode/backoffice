const mongoose = require('mongoose');

require('../modules/users/user.model');
require('../modules/roles/role.model');
require('../modules/resources/resource.model');
require('../modules/permissions/permission.model');
require('../modules/departments/department.model');
require('../modules/employees/employee.model');
require('../modules/payroll/payroll.model');
require('../modules/leave/leave.model');
require('../modules/audit/auditLog.model');
require('../modules/auth/refreshToken.model');

async function ensureCollections() {
  const conn = mongoose.connection;
  if (conn.readyState !== 1) return;

  const existing     = await conn.db.listCollections().toArray();
  const existingNames = new Set(existing.map(c => c.name));

  for (const modelName of mongoose.modelNames()) {
    const collName = mongoose.model(modelName).collection.name;
    if (existingNames.has(collName)) continue;
    await conn.db.createCollection(collName);
    // console.log(` Created collection: ${collName}`);
  }
}

async function syncIndexes() {
//   console.log('Syncing indexes...');

  const models = mongoose.modelNames();

  for (const modelName of models) {
    const model = mongoose.model(modelName);
    try {
      await model.syncIndexes();
    //   console.log(`Indexes synced: ${model.collection.name}`);
    } catch (err) {
      console.error(`Index sync failed for ${model.collection.name}:`, err.message);
    }
  }

//   console.log('All indexes synced\n');
}

async function dbInit() {
  await ensureCollections();
  await syncIndexes();
}

module.exports = dbInit;