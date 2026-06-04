const mysql = require('mysql2/promise');
const env = require('../config/env');

function getDatabaseConfig() {
  if (env.databaseUrl) {
    const url = new URL(env.databaseUrl);
    const databaseName = url.pathname.replace('/', '') || 'turnit_phase1';
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      databaseName
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    databaseName: env.dbName
  };
}

async function createDatabase() {
  const { databaseName, ...connectionConfig } = getDatabaseConfig();
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error('Database name contains unsupported characters.');
  }

  const connection = await mysql.createConnection(connectionConfig);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database ${databaseName} is ready`);
  await connection.end();
}

createDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
