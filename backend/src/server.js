const app = require('./app');
const env = require('./config/env');
const { closeDatabase, connectDatabase } = require('./config/db');
const { startFileCleanup, stopFileCleanup } = require('./services/fileCleanup');

let server;

async function start() {
  await connectDatabase();
  startFileCleanup();
  server = app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
}

async function shutdown() {
  if (!server) {
    stopFileCleanup();
    await closeDatabase();
    process.exit(0);
  }

  server.close(async () => {
    stopFileCleanup();
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(async (error) => {
  console.error(error);
  await closeDatabase();
  process.exit(1);
});
