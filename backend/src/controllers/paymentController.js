const crypto = require('crypto');
const env = require('../config/env');
const { CustomerPackage, Order } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { notifyRole } = require('../utils/notificationService');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function verifyPayhereHash({ merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig }) {
  const secretHash = md5(env.payhereMerchantSecret).toUpperCase();
  const expected = md5(
    `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`
  ).toUpperCase();
  return expected === md5sig;
}

const notify = asyncHandler(async (req, res) => {
  const {
    merchant_id,
    order_id,
    payment_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig
  } = req.body;

  if (env.payheremerchantId && merchant_id !== env.payheremerchantId) {
    return res.status(400).send('Invalid merchant');
  }

  if (env.payhereMerchantSecret) {
    if (!verifyPayhereHash({ merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig })) {
      return res.status(400).send('Invalid signature');
    }
  }

  const order = await Order.findOne({ order_number: order_id });
  if (!order) {
    return res.status(200).send('OK');
  }

  const code = Number(status_code);

  if (code === 2) {
    order.payment_status = 'paid';
    order.order_status = 'available';
    await order.save();

    if (order.customer_package_id) {
      const pkg = await CustomerPackage.findById(order.customer_package_id);
      if (pkg) {
        pkg.payment_status = 'paid';
        pkg.used_file_count = (Number(pkg.used_file_count) || 0) + Number(order.file_count || 0);
        pkg.status = pkg.used_file_count >= pkg.package_file_count ? 'used' : 'active';
        await pkg.save();
      }
    }

    await notifyRole({
      role: 'staff',
      orderId: order.id,
      type: 'new_order_available',
      title: 'New order available',
      message: `${order.order_number} is ready to accept with ${order.file_count} file(s).`,
      linkPath: '/staff/available-orders'
    });
  } else if (code === 0) {
    order.payment_status = 'pending';
    await order.save();
  } else if (code === -1 || code === -2 || code === -3) {
    order.payment_status = 'failed';
    order.order_status = 'cancelled';
    await order.save();

    if (order.customer_package_id) {
      await CustomerPackage.findByIdAndUpdate(order.customer_package_id, {
        payment_status: 'failed',
        status: 'cancelled'
      });
    }
  }

  res.status(200).send('OK');
});

module.exports = { notify };
