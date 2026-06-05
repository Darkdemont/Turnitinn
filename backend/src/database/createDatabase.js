const { closeDatabase, connectDatabase } = require('../config/db');
const models = require('../models');

async function createDatabase() {
  await connectDatabase();
  await Promise.all(Object.values(models).map((Model) => Model.createIndexes()));
  console.log('MongoDB collections and indexes are ready.');
  await closeDatabase();
}

createDatabase().catch(async (error) => {
  console.error(error);
  await closeDatabase();
  process.exit(1);
});
