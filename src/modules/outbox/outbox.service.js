const OutboxEvent = require('./outbox.model');
const queues      = require('../../jobs/queue');

function isDeliveryIdDuplicate(writeError) {
  const code = writeError.code ?? writeError.err?.code;
  const message = writeError.errmsg ?? writeError.err?.errmsg ?? '';
  return code === 11000 && message.includes('deliveryId');
}

function onlyDeliveryIdDuplicates(err) {
  const writeConcernErrors = err.writeConcernErrors ?? err.result?.writeConcernErrors ?? [];
  if (err.writeConcernError || writeConcernErrors.length) return false;
  if (err.writeErrors?.length) return err.writeErrors.every(isDeliveryIdDuplicate);
  return isDeliveryIdDuplicate(err);
}

const outboxService = {
  async enqueue(deliveries, session) {
    if (deliveries.length === 0) return [];
    await OutboxEvent.insertMany(deliveries, { session });
    return deliveries.map(d => d.deliveryId);
  },

  async enqueueOnce(deliveries) {
    await Promise.all(deliveries.map(d => new OutboxEvent(d).validate()));
    try {
      await OutboxEvent.insertMany(deliveries, { ordered: false, throwOnValidationError: true });
    } catch (err) {
      if (!onlyDeliveryIdDuplicates(err)) throw err;
    }
    return deliveries.map(d => d.deliveryId);
  },

  async markEmailResult(deliveryId, { sent, error }) {
    const update = sent
      ? { $set: { status: 'delivered', deliveredAt: new Date() }, $unset: { lockedUntil: 1, lastError: 1 } }
      : { $set: { status: 'failed', lastError: error }, $unset: { lockedUntil: 1 } };
    return OutboxEvent.updateOne(
      { deliveryId, channel: 'email', status: { $in: ['processing', 'queued'] } },
      update
    );
  },

  async listFailed(deliveryIds) {
    return OutboxEvent.find({ status: 'failed', ...(deliveryIds && { deliveryId: { $in: deliveryIds } }) })
      .select('deliveryId eventType channel attempts lastError updatedAt')
      .lean();
  },

  async retryFailed(deliveryIds) {
    const failed = await outboxService.listFailed(deliveryIds);
    for (const event of failed) {
      if (event.channel === 'email') {
        const job = await queues.emailQueue.getJob(event.deliveryId);
        if (job && await job.getState() === 'failed') await job.remove();
      }
      await OutboxEvent.updateOne(
        { _id: event._id, status: 'failed' },
        { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date() }, $unset: { lastError: 1, lockedUntil: 1 } }
      );
    }
    return failed.map(e => e.deliveryId);
  },

  async getStatus(deliveryIds) {
    return OutboxEvent.find({ deliveryId: { $in: deliveryIds } })
      .select('deliveryId eventType channel status attempts lastError deliveredAt')
      .lean();
  }
};

module.exports = outboxService;
