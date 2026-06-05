const { ActivityLog } = require('../models');

async function logActivity({
  userId = null,
  orderId = null,
  action,
  description,
  ipAddress = null
}) {
  await ActivityLog.create({
    user_id: userId,
    order_id: orderId,
    action,
    description,
    ip_address: ipAddress
  });
}

module.exports = {
  logActivity
};
