const mongoose = require('mongoose');

module.exports = {
  async up() {
    const db = mongoose.connection.db;

    // add bankDetails field to all existing employees
    await db.collection('employees').updateMany(
      { bankDetails: { $exists: false } },
      {
        $set: {
          bankDetails: {
            bankName:      '',
            accountNumber: '',
            accountName:   ''
          }
        }
      }
    );

    console.log('  → Employee bank details field added');
  }
};