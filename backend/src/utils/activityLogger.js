const { pool } = require('../config/db');

async function logActivity({
  userId = null,
  orderId = null,
  action,
  description,
  ipAddress = null,
  client = pool
}) {
  await client.query(
    `INSERT INTO activity_logs (user_id, order_id, action, description, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, orderId, action, description, ipAddress]
  );
}

module.exports = {
  logActivity
};
