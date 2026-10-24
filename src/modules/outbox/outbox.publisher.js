const OutboxEvent         = require('./outbox.model');
const notificationService = require('../notification/notification.service');
const queues              = require('../../jobs/queue');

const MAX_ATTEMPTS = 8;
const LOCK_MS      = 60 * 1000;
const RECHECK_MS   = Number(process.env.OUTBOX_QUEUED_RECHECK_MS) || 60 * 60 * 1000;
const POLL_MS      = Number(process.env.OUTBOX_POLL_MS) || 5000;
const TIMEOUT_MS   = Number(process.env.OUTBOX_DELIVERY_TIMEOUT_MS) || 10000;

async function enqueueEmail(event) {
  const existing = await queues.emailQueue.getJob(event.deliveryId);
  if (!existing) {
    await queues.emailQueue.add(event.payload, { jobId: event.deliveryId });
    return { status: 'queued' };
  }
  const state = await existing.getState();
  if (state === 'completed') return { status: 'delivered' };
  if (state === 'failed') return { status: 'failed', error: 'EmailJobFailed' };
  return { status: 'queued' };
}

const defaultAdapters = {
  notification: async (event) => {
    await notificationService.send({ ...event.payload, deliveryId: event.deliveryId });
    return { status: 'delivered' };
  },
  email: enqueueEmail
};

let adapters = { ...defaultAdapters };
let timer    = null;
let running  = null;

function withTimeout(promise) {
  let handle;
  const timeout = new Promise((resolve, reject) => {
    handle = setTimeout(() => reject(Object.assign(new Error('Delivery timed out'), { name: 'TimeoutError' })), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(handle));
}

function safeError(err) {
  return `${err.name || 'Error'}${err.code ? ` (${err.code})` : ''}`.slice(0, 200);
}

function backoffMs(attempts) {
  return Math.min(2 ** attempts * 1000, 60 * 60 * 1000);
}

async function claimNext(now) {
  return OutboxEvent.findOneAndUpdate(
    {
      $or: [
        { status: 'pending',    nextAttemptAt: { $lte: now } },
        { status: 'processing', lockedUntil:   { $lte: now } },
        { status: 'queued',     lockedUntil:   { $lte: now } }
      ]
    },
    {
      $set: { status: 'processing', lockedUntil: new Date(now.getTime() + LOCK_MS) },
      $inc: { attempts: 1 }
    },
    { sort: { nextAttemptAt: 1 }, new: true }
  );
}

function outcomeUpdate(outcome, now) {
  if (outcome.status === 'queued') {
    return { $set: { status: 'queued', queuedAt: now, lockedUntil: new Date(now.getTime() + RECHECK_MS) }, $unset: { lastError: 1 } };
  }
  if (outcome.status === 'failed') {
    return { $set: { status: 'failed', lastError: outcome.error }, $unset: { lockedUntil: 1 } };
  }
  return { $set: { status: 'delivered', deliveredAt: new Date() }, $unset: { lockedUntil: 1, lastError: 1 } };
}

async function publishOne(event, now) {
  try {
    const outcome = (await withTimeout(Promise.resolve().then(() => adapters[event.channel](event)))) || { status: 'delivered' };
    await OutboxEvent.updateOne({ _id: event._id, status: 'processing' }, outcomeUpdate(outcome, now));
    return outcome.status !== 'failed';
  } catch (err) {
    const exhausted = event.attempts >= MAX_ATTEMPTS;
    await OutboxEvent.updateOne(
      { _id: event._id, status: 'processing' },
      {
        $set: {
          status:        exhausted ? 'failed' : 'pending',
          lastError:     safeError(err),
          nextAttemptAt: new Date(now.getTime() + backoffMs(event.attempts))
        },
        $unset: { lockedUntil: 1 }
      }
    );
    console.error(`Outbox delivery ${event.deliveryId} failed: ${safeError(err)}`);
    return false;
  }
}

async function drain(limit, now) {
  const result = { delivered: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const event = await claimNext(now || new Date());
    if (!event) break;
    if (await publishOne(event, now || new Date())) result.delivered++;
    else result.failed++;
  }
  return result;
}

const outboxPublisher = {
  publishPending({ limit = 100, now } = {}) {
    if (running) return running.then(() => outboxPublisher.publishPending({ limit, now }));
    running = drain(limit, now).finally(() => { running = null; });
    return running;
  },

  kick() {
    if (!timer) return;
    setImmediate(() => {
      outboxPublisher.publishPending().catch(err => console.error('Outbox publish failed:', err.message));
    });
  },

  start() {
    if (timer) return;
    timer = setInterval(() => outboxPublisher.kick(), POLL_MS);
    timer.unref();
    outboxPublisher.kick();
  },

  async stop() {
    clearInterval(timer);
    timer = null;
    if (running) await running.catch(() => {});
  },

  setAdapters(overrides) {
    adapters = { ...defaultAdapters, ...overrides };
  },

  resetAdapters() {
    adapters = { ...defaultAdapters };
  }
};

module.exports = outboxPublisher;
