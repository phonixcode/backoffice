const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });
};

start();