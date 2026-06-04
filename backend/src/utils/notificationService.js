const { query } = require('../config/db');

function dbFromClient(client) {
  return client || { query };
}

async function notifyUser({ userId, orderId = null, type, title, message, linkPath = null, client = null }) {
  const db = dbFromClient(client);
  await db.query(
    `INSERT INTO notifications (user_id, order_id, type, title, message, link_path)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, orderId, type, title, message, linkPath]
  );
}

async function notifyRole({ role, orderId = null, type, title, message, linkPath = null, client = null }) {
  const db = dbFromClient(client);
  await db.query(
    `INSERT INTO notifications (user_id, order_id, type, title, message, link_path)
     SELECT id, $2, $3, $4, $5, $6
     FROM users
     WHERE role = $1 AND status = 'active'`,
    [role, orderId, type, title, message, linkPath]
  );
}

module.exports = {
  notifyRole,
  notifyUser
};
