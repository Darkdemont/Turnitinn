const env = require('../config/env');
const { Order, OrderFile, ReportFile, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { generateOrderNumber } = require('../utils/orderNumber');
const { parseObjectId, plain, plainMany } = require('../utils/mongo');
const { removeTempFiles, storeUploadedFiles } = require('../utils/fileStorage');
const { notifyRole } = require('../utils/notificationService');

function fileExpiryDate() {
  return new Date(Date.now() + env.fileRetentionHours * 60 * 60 * 1000);
}

function fileHistoryFilter(orderId) {
  return {
    order_id: orderId
  };
}

async function orderSummary(order) {
  const [files, reports] = await Promise.all([
    OrderFile.find(fileHistoryFilter(order._id)).sort({ _id: 1 }),
    ReportFile.find(fileHistoryFilter(order._id)).sort({ uploaded_at: -1 })
  ]);

  return {
    ...plain(order),
    files: plainMany(files),
    reports: plainMany(reports),
    report_count: reports.length
  };
}

async function unpaidSummary(wholesalerId) {
  const rows = await Order.aggregate([
    {
      $match: {
        customer_id: parseObjectId(wholesalerId),
        account_type: 'wholesaler',
        order_status: 'completed',
        wholesaler_payment_status: 'unpaid'
      }
    },
    {
      $group: {
        _id: null,
        file_count: { $sum: '$file_count' },
        amount_lkr: { $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] } }
      }
    }
  ]);

  return {
    unpaid_completed_file_count: rows[0]?.file_count || 0,
    unpaid_amount_lkr: rows[0]?.amount_lkr || 0
  };
}

const dashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [summaryRows, recentDocs, wholesaler, due] = await Promise.all([
    Order.aggregate([
      { $match: { customer_id: parseObjectId(userId), account_type: 'wholesaler' } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          submitted_file_count: { $sum: '$file_count' },
          available_orders: { $sum: { $cond: [{ $eq: ['$order_status', 'available'] }, 1, 0] } },
          in_progress_orders: {
            $sum: {
              $cond: [{ $in: ['$order_status', ['accepted', 'checking', 'report_uploaded']] }, 1, 0]
            }
          },
          completed_file_count: {
            $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, '$file_count', 0] }
          }
        }
      }
    ]),
    Order.find({ customer_id: userId, account_type: 'wholesaler' })
      .sort({ created_at: -1 })
      .limit(8),
    User.findById(userId).select('rate_per_file_lkr'),
    unpaidSummary(userId)
  ]);

  res.json({
    summary: {
      total_orders: summaryRows[0]?.total_orders || 0,
      submitted_file_count: summaryRows[0]?.submitted_file_count || 0,
      available_orders: summaryRows[0]?.available_orders || 0,
      in_progress_orders: summaryRows[0]?.in_progress_orders || 0,
      completed_file_count: summaryRows[0]?.completed_file_count || 0,
      rate_per_file_lkr: wholesaler?.rate_per_file_lkr || 0,
      ...due
    },
    recent_orders: await Promise.all(recentDocs.map(orderSummary))
  });
});

const createOrder = asyncHandler(async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    if (!uploadedFiles.length) {
      throw new HttpError(400, 'Upload at least one assignment file.');
    }

    const wholesaler = await User.findById(req.user.id).select('rate_per_file_lkr');
    const fileCount = uploadedFiles.length;
    const ratePerFile = Number(wholesaler?.rate_per_file_lkr || 0);
    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      order_number: orderNumber,
      customer_id: req.user.id,
      account_type: 'wholesaler',
      service_type: 'ai_similarity',
      file_count: fileCount,
      price_per_file_lkr: ratePerFile,
      total_amount_lkr: 0,
      currency: 'LKR',
      payment_status: 'paid',
      order_status: 'available',
      wholesaler_payment_status: 'unpaid'
    });

    const storedFiles = await storeUploadedFiles(orderNumber, uploadedFiles, 'orders');
    const expiresAt = fileExpiryDate();
    await OrderFile.insertMany(
      storedFiles.map((file) => ({
        order_id: order._id,
        ...file,
        expires_at: expiresAt
      }))
    );

    await logActivity({
      userId: req.user.id,
      orderId: order.id,
      action: 'wholesaler_order_created',
      description: `${order.order_number} created by wholesaler ${req.user.email} with ${fileCount} file(s).`,
      ipAddress: req.ip
    });

    await notifyRole({
      role: 'staff',
      orderId: order.id,
      type: 'new_order_available',
      title: 'New wholesaler order available',
      message: `${order.order_number} is ready to accept with ${fileCount} file(s).`,
      linkPath: '/staff/available-orders'
    });

    res.status(201).json({
      order: plain(order),
      files: storedFiles.map((file, index) => ({
        id: index + 1,
        original_file_name: file.original_file_name,
        file_size: file.file_size,
        file_type: file.file_type,
        expires_at: expiresAt
      }))
    });
  } catch (error) {
    await removeTempFiles(uploadedFiles);
    throw error;
  }
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer_id: req.user.id, account_type: 'wholesaler' }).sort({ created_at: -1 });
  res.json({ orders: await Promise.all(orders.map(orderSummary)) });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findOne({
    _id: orderId,
    customer_id: req.user.id,
    account_type: 'wholesaler'
  });
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const [files, reports, staff] = await Promise.all([
    OrderFile.find(fileHistoryFilter(orderId)).sort({ _id: 1 }),
    ReportFile.find(fileHistoryFilter(orderId)).sort({ uploaded_at: -1 }),
    order.accepted_by_staff_id ? User.findById(order.accepted_by_staff_id).select('name') : null
  ]);

  res.json({
    order: {
      ...plain(order),
      staff_name: staff?.name || null
    },
    files: plainMany(files),
    reports: plainMany(reports)
  });
});

module.exports = {
  createOrder,
  dashboard,
  getOrderDetails,
  listOrders
};
