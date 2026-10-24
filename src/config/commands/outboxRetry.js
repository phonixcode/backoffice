const mongoose = require('mongoose');
const connectDB = require('../db');
const { closeQueues } = require('../../jobs/queue');
const outboxService = require('../../modules/outbox/outbox.service');

async function main() {
  const apply = process.argv.includes('--apply');
  const ids = process.argv
    .filter(arg => arg.startsWith('--delivery-id='))
    .map(arg => arg.slice('--delivery-id='.length));
  const filter = ids.length ? ids : undefined;

  await connectDB();
  const failed = await outboxService.listFailed(filter);
  failed.forEach(e => console.log(`${e.deliveryId} ${e.channel} attempts=${e.attempts} lastError=${e.lastError || ''}`));
  console.log(`${failed.length} failed delivery intent(s)`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to return these intents to pending.');
    return;
  }
  const retried = await outboxService.retryFailed(filter);
  console.log(`${retried.length} delivery intent(s) returned to pending; the outbox publisher will resend them`);
}

main()
  .catch((err) => {
    console.error(`Outbox retry failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeQueues();
    await mongoose.disconnect();
  });
