const Bull = require('bull');

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
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

const pdfQueue = new Bull('pdf-generation', redisConfig);
const csvQueue = new Bull('csv-export',     redisConfig);

module.exports = { pdfQueue, csvQueue };