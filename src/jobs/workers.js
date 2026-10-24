const outboxPublisher = require('../modules/outbox/outbox.publisher');

let started = false;

async function startWorkers() {
  if (started) return;
  started = true;
  await Promise.all([
    require('./processors/pdf.processor').register(),
    require('./processors/csv.processor').register(),
    require('./processors/email.processor').register()
  ]);
  outboxPublisher.start();
}

module.exports = { startWorkers };
