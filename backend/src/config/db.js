const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(env.mongoUri);
  return mongoose.connection;
}

async function closeDatabase() {
  await mongoose.connection.close();
}

module.exports = {
  closeDatabase,
  connectDatabase,
  mongoose,
  pool: {
    end: closeDatabase
  }
};
