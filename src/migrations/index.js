const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');

const migrationSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true },
  executedAt: { type: Date, default: Date.now }
});

const Migration = mongoose.model('Migration', migrationSchema);

async function runMigrations() {
  await connectDB();
  console.log('Running migrations...');

  const scriptsDir = path.join(__dirname, 'scripts');
  const files = fs.readdirSync(scriptsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const alreadyRan = await Migration.findOne({ name: file });
    if (alreadyRan) {
      console.log(`Skipping ${file} — already ran`);
      continue;
    }

    try {
      console.log(`Running ${file}...`);
      const migration = require(path.join(scriptsDir, file));
      await migration.up();

      await Migration.create({ name: file });
      console.log(`${file} completed`);
    } catch (err) {
      console.error(`${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed');
  await mongoose.disconnect();
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});