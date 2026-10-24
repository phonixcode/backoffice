const mongoose = require('mongoose');
const connectDB = require('../db');
const env = require('../env');
const { ensureCollections, diffIndexes, syncIndexes } = require('../dbInit');
const { databaseNameFromUri } = require('../mongoUri');

async function main() {
  const apply = process.argv.includes('--apply');
  const target = databaseNameFromUri(env.mongoUri);
  if (apply && env.nodeEnv === 'production') {
    if (!target) throw new Error('In production, MONGODB_URI must name the database explicitly');
    if (!process.argv.includes(`--confirm=${target}`)) {
      throw new Error('In production, --apply also requires --confirm=<database name>');
    }
  }

  await connectDB();
  const actual = mongoose.connection.db.databaseName;
  if (target && actual !== target) throw new Error(`Connected to "${actual}" but MONGODB_URI names "${target}"`);
  console.log(`Target database: ${actual}`);
  await ensureCollections();

  const diffs = (await diffIndexes()).filter(d => d.toDrop.length || d.toCreate.length);
  if (diffs.length === 0) {
    console.log('Indexes match the model definitions');
    return;
  }
  diffs.forEach(d => {
    console.log(`${d.collection}: create ${JSON.stringify(d.toCreate)} drop ${JSON.stringify(d.toDrop)}`);
  });

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to synchronize these indexes.');
    return;
  }

  const failures = await syncIndexes();
  failures.forEach(f => console.error(`Index sync failed for ${f.collection}: ${f.error}`));
  if (failures.length) process.exitCode = 1;
  else console.log('Indexes synchronized');
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(`Index migration failed: ${err.message}`);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
