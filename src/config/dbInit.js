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
// require('../modules/notifications/notification.model');
require('../modules/attendance/attendance.model');
require('../modules/attendance/attendance-settings.model');
require('../modules/notification/notification.model');
require('../modules/outbox/outbox.model');

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

async function diffIndexes() {
  const diffs = [];
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    const { toDrop, toCreate } = await model.diffIndexes();
    diffs.push({ collection: model.collection.name, toDrop, toCreate });
  }
  return diffs;
}

async function syncIndexes() {
  const failures = [];
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    try {
      await model.syncIndexes();
    } catch (err) {
      failures.push({ collection: model.collection.name, error: err.message });
    }
  }
  return failures;
}

async function dbInit() {
  await ensureCollections();
}

module.exports = dbInit;
module.exports.ensureCollections = ensureCollections;
module.exports.diffIndexes = diffIndexes;
module.exports.syncIndexes = syncIndexes;