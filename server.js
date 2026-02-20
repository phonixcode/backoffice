const app       = require('./src/app');
const connectDB = require('./src/config/db');
const dbInit    = require('./src/config/dbInit');
const env       = require('./src/config/env');
const path      = require('path');
const fs        = require('fs');

// background workers
require('./src/jobs/processors/pdf.processor');
require('./src/jobs/processors/csv.processor');
require('./src/jobs/processors/email.processor');

const STORAGE_DIRS = [
  path.join(process.cwd(), 'storage', 'pdfs'),
  path.join(process.cwd(), 'storage', 'csv')
];

function cleanupExpiredFiles() {
  let totalCleaned = 0;

  STORAGE_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);

      try {
        const stats    = fs.statSync(filePath);
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
setInterval(cleanupExpiredFiles, 60 * 60 * 1000);

const start = async () => {
  await connectDB();
  await dbInit();

  app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
    console.log(`background worker started`);
    console.log(`File cleanup scheduled every 1 hour (24h expiry)`);
    cleanupExpiredFiles();
  });
};

start();