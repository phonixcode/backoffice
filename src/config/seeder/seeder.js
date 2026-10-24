const mongoose = require('mongoose');
const connectDB = require('../db');
const { ensureCollections } = require('../dbInit');
const { runBootstrap, grantEmployeeLeaveCancel, readAdminInput, BootstrapError } = require('../bootstrap');

async function main() {
  const admin = readAdminInput();
  await connectDB();
  await ensureCollections();

  const summary = await runBootstrap({ admin });
  console.log(`Bootstrap complete: ${summary.resources} resource(s) and ${summary.permissions} permission(s) added`);
  console.log(summary.createdAdmin ? 'Administrator account created' : 'Existing administrator left unchanged');

  if (process.argv.includes('--grant-employee-leave-cancel')) {
    const { updatedUsers } = await grantEmployeeLeaveCancel();
    console.log(`employee role granted leave:cancel; ${updatedUsers} user permission cache(s) updated`);
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(`Bootstrap failed: ${err instanceof BootstrapError ? err.message : err.name}`);
    if (!(err instanceof BootstrapError)) console.error(err.stack);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
