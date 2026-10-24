process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT',  () => handleSignal('SIGINT'));

const app       = require('./src/app');
const connectDB = require('./src/config/db');
const dbInit    = require('./src/config/dbInit');
const env       = require('./src/config/env');
const mongoose  = require('mongoose');
const path      = require('path');
const fs        = require('fs');
const { startWorkers }    = require('./src/jobs/workers');
const { closeQueues }     = require('./src/jobs/queue');
const outboxPublisher     = require('./src/modules/outbox/outbox.publisher');
const { sseManager }      = require('./src/modules/notification/sse.manager');

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const STORAGE_DIRS = [
  path.join(STORAGE_ROOT, 'pdfs'),
  path.join(STORAGE_ROOT, 'csv'),
  path.join(STORAGE_ROOT, 'csv', '.meta')
];

function cleanupExpiredFiles() {
  let totalCleaned = 0;

  STORAGE_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);

      try {
        const stats    = fs.statSync(filePath);
        if (!stats.isFile()) return;
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

        if (ageHours > 24) {
          fs.unlinkSync(filePath);
          totalCleaned++;
          console.log(`Cleaned up expired file: ${file}`);
        }
      } catch (err) {
        console.error(`Failed to clean up file ${file}:`, err.message);
      }
    });
  });

  if (totalCleaned > 0) {
    console.log(`Cleanup complete — removed ${totalCleaned} expired file(s)`);
  }
}

STORAGE_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created storage directory: ${dir}`);
  }
});

// run cleanup every hour
const cleanupTimer = setInterval(cleanupExpiredFiles, 60 * 60 * 1000);

let server = null;
let connecting = null;
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received — shutting down`);
  clearInterval(cleanupTimer);
  if (server) server.close();
  sseManager.closeAll();
  await outboxPublisher.stop();
  await closeQueues();
  if (connecting) await connecting.catch(() => {});
  await mongoose.disconnect();
  process.exit(0);
}

function handleSignal(signal) {
  shutdown(signal).catch(err => {
    console.error('Shutdown failed:', err.message);
    process.exit(1);
  });
}

const start = async () => {
  connecting = connectDB();
  await connecting;
  if (stopping) return;
  await dbInit();
  if (stopping) return;

  if (process.env.RUN_WORKERS !== 'false') {
    await startWorkers();
    if (stopping) return;
    console.log(`background worker started`);
  } else {
    outboxPublisher.start();
  }

  server = app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
    console.log(`File cleanup scheduled every 1 hour (24h expiry)`);
    cleanupExpiredFiles();
  });
};

start().catch(err => {
  if (stopping) return;
  console.error('Startup failed:', err.message);
  process.exit(1);
});
