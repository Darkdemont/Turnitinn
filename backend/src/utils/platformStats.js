const { Order } = require('../models');

async function getCompletedReportsCount() {
  return Order.countDocuments({ order_status: 'completed' });
}

module.exports = { getCompletedReportsCount };
