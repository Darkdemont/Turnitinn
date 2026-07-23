const { Order } = require('../models');

async function getCompletedReportsCount() {
  const rows = await Order.aggregate([
    { $match: { order_status: { $in: ['report_uploaded', 'completed'] } } },
    { $group: { _id: null, total_files: { $sum: '$file_count' } } }
  ]);
  return rows[0]?.total_files || 0;
}

module.exports = { getCompletedReportsCount };
