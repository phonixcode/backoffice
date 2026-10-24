const Bull = require('bull');

const QUEUE_NAMES = {
  pdfQueue:   'pdf-generation',
  csvQueue:   'csv-export',
  emailQueue: 'email'
};

function redisConfig() {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db:   Number(process.env.REDIS_DB) || 0
    },
    prefix: process.env.BULL_PREFIX || 'bull',
    defaultJobOptions: {
      attempts:    3,           // retry failed jobs 3 times
      backoff: {
        type:  'exponential',
        delay: 2000             // wait 2s, 4s, 8s between retries
      },
      removeOnComplete: 10,     // keep last 10 completed jobs
      removeOnFail:     50      // keep last 50 failed jobs
    }
  };
}

const instances = new Map();

function createQueue(key) {
  const queue = new Bull(QUEUE_NAMES[key], redisConfig());
  // Bull 4.16 setHandler() calls setWorkerName() without handling its promise, so a close
  // during initialization became an unhandled rejection that crashed shutdown.
  const setWorkerName = queue.setWorkerName.bind(queue);
  queue.setWorkerName = () => {
    queue.workerNamed = setWorkerName().catch(err => {
      if (!queue.closing) console.error(`Queue ${QUEUE_NAMES[key]} worker naming failed:`, err?.message);
    });
    return queue.workerNamed;
  };
  return queue;
}

function getQueue(key) {
  if (!QUEUE_NAMES[key]) throw new Error(`Unknown queue: ${key}`);
  if (!instances.has(key)) instances.set(key, createQueue(key));
  return instances.get(key);
}

function workerReady(queue) {
  return Promise.all([queue.isReady(), queue.workerNamed]);
}

async function closeQueues() {
  const open = [...instances.values()];
  instances.clear();
  await Promise.all(open.map(queue => queue.close()));
}

const queues = { getQueue, closeQueues, workerReady };
Object.keys(QUEUE_NAMES).forEach(key => {
  Object.defineProperty(queues, key, { enumerable: true, get: () => getQueue(key) });
});

module.exports = queues;
