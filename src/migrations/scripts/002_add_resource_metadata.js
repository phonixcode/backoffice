const mongoose = require('mongoose');

module.exports = {
  async up() {
    const db = mongoose.connection.db;

    // add isSystem field to core resources
    // system resources cannot be deleted by admins
    await db.collection('resources').updateMany(
      { name: { $in: ['users', 'roles', 'resources', 'audit'] } },
      { $set: { isSystem: true } }
    );

    // all others are non-system
    await db.collection('resources').updateMany(
      { isSystem: { $exists: false } },
      { $set: { isSystem: false } }
    );

    console.log('  → Resource metadata updated');
  }
};