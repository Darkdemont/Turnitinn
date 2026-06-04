const mysql = require('mysql2/promise');
const env = require('./env');

function mysqlConfig() {
  const base = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    decimalNumbers: true,
    multipleStatements: true,
    namedPlaceholders: false
  };

  if (env.databaseUrl) {
    const url = new URL(env.databaseUrl);
    return {
      ...base,
      host: url.hostname,
      port: Number(url.port || 3306),
      database: url.pathname.replace('/', '') || undefined,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password)
    };
  }

  return {
    ...base,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'turnit_phase1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };
}

function toMysqlQuery(text, params = []) {
  const values = [];
  const sql = text.replace(/\$(\d+)/g, (_, index) => {
    values.push(params[Number(index) - 1]);
    return '?';
  });

  return { sql, values };
}

function normalizeResult(rows, result) {
  if (Array.isArray(rows)) {
    return {
      rows,
      rowCount: rows.length,
      insertId: result?.insertId,
      affectedRows: result?.affectedRows || 0
    };
  }

  return {
    rows: [],
    rowCount: rows?.affectedRows || 0,
    insertId: rows?.insertId,
    affectedRows: rows?.affectedRows || 0
  };
}

async function runQuery(executor, text, params = []) {
  const { sql, values } = toMysqlQuery(text, params);
  const [rows] = await executor.query(sql, values);
  return normalizeResult(rows);
}

const mysqlPool = mysql.createPool(mysqlConfig());

const pool = {
  async query(text, params = []) {
    return runQuery(mysqlPool, text, params);
  },

  async connect() {
    const connection = await mysqlPool.getConnection();
    return {
      async query(text, params = []) {
        return runQuery(connection, text, params);
      },
      release() {
        connection.release();
      }
    };
  },

  async end() {
    await mysqlPool.end();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
