const mongoose = require('mongoose');
const env = require('./env');

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(env.mongoUri);
//     console.log(`MongoDB connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`MongoDB connection error: ${error.message}`);
//     process.exit(1);
//   }
// };

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      maxPoolSize:              10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
      family:                   4
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    // log slow queries in development
    if (env.nodeEnv === 'development') {
      mongoose.set('debug', (collectionName, method, query, doc, options) => {
        const start = Date.now();
        process.nextTick(() => {
          const duration = Date.now() - start;
          if (duration > 100) { // log queries taking more than 100ms
            console.warn(`Slow query [${duration}ms] ${collectionName}.${method}`, JSON.stringify(query));
          }
        });
      });
    }

    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;