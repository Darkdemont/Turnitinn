const { z } = require('zod');
const env = require('../config/env');
const {
  Order,
  OrderFile,
  ReportFile,
  StaffEarning
} = require('../models');
const { STAFF_RATE_PER_FILE_USD } = require('../constants/pricing');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { objectIdEquals, parseObjectId, plain, plainMany } = require('../utils/mongo');
const { removeTempFiles, storeUploadedFiles } = require('../utils/fileStorage');
const { notifyUser } = require('../utils/notificationService');

const REQUIRED_REPORT_FILE_COUNT = 2;
const ACTIVE_STAFF_STATUSES = ['accepted', 'checking', 'report_uploaded'];
const REPORT_TYPES = ['similarity', 'ai'];

const optionalPercentage = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().min(0).max(100).optional()
);

const reportMetadataSchema = z.object({
  ai_score: optionalPercentage,
  similarity_score: optionalPercentage
});

function fileExpiryDate() {
  return new Date(Date.now() + env.fileRetentionHours * 60 * 60 * 1000);
}

function activeFileFilter(orderId) {
  return {
    order_id: orderId,
    deleted_at: { $exists: false }
  };
}

function visibleAvailableOrderFilter(staffId) {
  return {
    order_status: 'available',
    payment_status: 'paid',
    accepted_by_staff_id: { $exists: false },
    declined_by_staff_ids: { $ne: parseObjectId(staffId) }
  };
}

function ownerOrderPath(order) {
  return order.account_type === 'wholesaler'
    ? `/wholesaler/orders/${order.id}`
    : `/customer/orders/${order.id}`;
}

async function queueOrderSummary(order) {
  const files = await OrderFile.find(activeFileFilter(order._id))
    .sort({ _id: 1 })
    .select('original_file_name file_size file_type uploaded_at');
  const plainFiles = plainMany(files);

  return {
    id: order.id,
    order_number: order.order_number,
    account_type: order.account_type,
    service_type: order.service_type,
    file_count: order.file_count,
    total_file_size: plainFiles.reduce((total, file) => total + Number(file.file_size || 0), 0),
    files: plainFiles,
    payment_status: order.payment_status,
    order_status: order.order_status,
    created_at: order.created_at
  };
}

const dashboard = asyncHandler(async (req, res) => {
  const availableFilter = visibleAvailableOrderFilter(req.user.id);
  const [available, active, completed, earningsRows, availableDocs, activeDocs] = await Promise.all([
    Order.countDocuments(availableFilter),
    Order.countDocuments({
      accepted_by_staff_id: req.user.id,
      order_status: { $in: ACTIVE_STAFF_STATUSES }
    }),
    Order.countDocuments({
      accepted_by_staff_id: req.user.id,
      order_status: 'completed'
    }),
    StaffEarning.aggregate([
      { $match: { staff_id: parseObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          total_completed_files: { $sum: '$completed_file_count' },
          total_earning_usd: { $sum: '$total_earning_usd' }
        }
      }
    ]),
    Order.find(availableFilter)
      .sort({ created_at: 1 })
      .limit(5)
      .select('order_number account_type service_type file_count order_status created_at'),
    Order.find({
      accepted_by_staff_id: req.user.id,
      order_status: { $in: ACTIVE_STAFF_STATUSES }
    })
      .sort({ updated_at: -1 })
      .limit(5)
      .select('order_number account_type service_type file_count order_status accepted_at completed_at')
  ]);

  const activeOrders = await Promise.all(
    activeDocs.map(async (order) => {
      const [files, reportCount] = await Promise.all([
        OrderFile.find(activeFileFilter(order._id)).sort({ _id: 1 }),
        ReportFile.countDocuments({ order_id: order._id })
      ]);

      return {
        ...plain(order),
        files: plainMany(files),
        report_count: reportCount
      };
    })
  );

  res.json({
    summary: {
      available_orders: available,
      my_active_orders: active,
      max_active_orders: env.staffMaxActiveOrders,
      remaining_accept_slots: Math.max(0, env.staffMaxActiveOrders - active),
      my_completed_orders: completed,
      total_completed_files: earningsRows[0]?.total_completed_files || 0,
      total_earning_usd: earningsRows[0]?.total_earning_usd || 0
    },
    available_orders: await Promise.all(availableDocs.map(queueOrderSummary)),
    active_orders: activeOrders,
    recent_orders: activeOrders
  });
});

const availableOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find(visibleAvailableOrderFilter(req.user.id)).sort({ created_at: 1 });

  res.json({ orders: await Promise.all(orders.map(queueOrderSummary)) });
});

const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ accepted_by_staff_id: req.user.id }).sort({ updated_at: -1 });
  const rows = await Promise.all(
    orders.map(async (order) => ({
      ...plain(order),
      report_count: await ReportFile.countDocuments({ order_id: order._id })
    }))
  );
  res.json({ orders: rows });
});

const completedOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    accepted_by_staff_id: req.user.id,
    order_status: 'completed'
  }).sort({ completed_at: -1 });

  const rows = await Promise.all(
    orders.map(async (order) => {
      const earning = await StaffEarning.findOne({ order_id: order._id }).select('total_earning_usd');
      return {
        id: order.id,
        order_number: order.order_number,
        account_type: order.account_type,
        service_type: order.service_type,
        file_count: order.file_count,
        completed_at: order.completed_at,
        total_earning_usd: earning?.total_earning_usd || 0
      };
    })
  );

  res.json({ orders: rows });
});

const acceptOrder = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const activeCount = await Order.countDocuments({
    accepted_by_staff_id: req.user.id,
    order_status: { $in: ACTIVE_STAFF_STATUSES }
  });

  if (activeCount >= env.staffMaxActiveOrders) {
    throw new HttpError(
      409,
      `You already have ${env.staffMaxActiveOrders} active orders. Complete one before accepting another order.`
    );
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      order_status: 'available',
      accepted_by_staff_id: { $exists: false },
      declined_by_staff_ids: { $ne: parseObjectId(req.user.id) }
    },
    {
      accepted_by_staff_id: req.user.id,
      accepted_at: new Date(),
      order_status: 'accepted'
    },
    { new: true }
  );

  if (!order) {
    throw new HttpError(409, 'This order was already accepted, declined, or is no longer available.');
  }

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_accepted',
    description: `${order.order_number} accepted by ${req.user.email}.`,
    ipAddress: req.ip
  });

  await notifyUser({
    userId: order.customer_id,
    orderId: order.id,
    type: 'order_accepted',
    title: 'Order accepted',
    message: `${order.order_number} has been accepted and will be checked soon.`,
    linkPath: ownerOrderPath(order)
  });

  res.json({ order: plain(order) });
});

const declineOrder = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      order_status: 'available',
      accepted_by_staff_id: { $exists: false }
    },
    {
      $addToSet: { declined_by_staff_ids: req.user.id }
    },
    { new: true }
  );

  if (!order) {
    throw new HttpError(404, 'Available order not found.');
  }

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_declined',
    description: `${order.order_number} declined by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.json({ order: plain(order) });
});

const releaseOrder = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findOne({
    _id: orderId,
    accepted_by_staff_id: req.user.id,
    order_status: { $in: ['accepted', 'checking'] }
  });

  if (!order) {
    throw new HttpError(404, 'Active accepted order not found.');
  }

  const reportCount = await ReportFile.countDocuments({ order_id: order._id });
  if (reportCount > 0) {
    throw new HttpError(400, 'This order already has uploaded reports and cannot be released.');
  }

  order.order_status = 'available';
  order.accepted_by_staff_id = undefined;
  order.declined_by_staff_ids.addToSet(parseObjectId(req.user.id));
  order.accepted_at = undefined;
  await order.save();

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_released',
    description: `${order.order_number} released back to the staff queue by ${req.user.email} and hidden from that staff member.`,
    ipAddress: req.ip
  });

  await notifyUser({
    userId: order.customer_id,
    orderId: order.id,
    type: 'order_released',
    title: 'Order returned to queue',
    message: `${order.order_number} was returned to the staff queue and will be accepted again soon.`,
    linkPath: ownerOrderPath(order)
  });

  res.json({ order: plain(order) });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const staffId = parseObjectId(req.user.id);
  const order = await Order.findOne({
    _id: orderId,
    $or: [
      { order_status: 'available', declined_by_staff_ids: { $ne: staffId } },
      { accepted_by_staff_id: req.user.id }
    ]
  });

  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const canViewFiles = objectIdEquals(order.accepted_by_staff_id, req.user.id);
  const [files, reports] = await Promise.all([
    canViewFiles
      ? OrderFile.find(activeFileFilter(orderId)).sort({ _id: 1 })
      : Promise.resolve([]),
    ReportFile.find({ order_id: orderId, uploaded_by_staff_id: req.user.id }).sort({ uploaded_at: -1 })
  ]);

  res.json({
    order: plain(order),
    files: plainMany(files),
    reports: plainMany(reports),
    can_download_order_files: canViewFiles
  });
});

const uploadReport = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const uploadedFiles = req.files || [];

  try {
    if (!uploadedFiles.length) {
      throw new HttpError(400, 'Upload at least one final report file.');
    }

    const payload = reportMetadataSchema.parse(req.body);
    const order = await Order.findById(orderId);
    if (!order) {
      throw new HttpError(404, 'Order not found.');
    }
    if (!objectIdEquals(order.accepted_by_staff_id, req.user.id)) {
      throw new HttpError(403, 'You can upload reports only for orders you accepted.');
    }
    if (order.order_status === 'completed' || order.order_status === 'cancelled') {
      throw new HttpError(400, 'This order can no longer receive reports.');
    }
    if (order.service_type === 'ai_similarity' && uploadedFiles.length !== REQUIRED_REPORT_FILE_COUNT) {
      throw new HttpError(400, 'Upload both report files: similarity report and AI report.');
    }

    const storedFiles = await storeUploadedFiles(order.order_number, uploadedFiles, 'reports');
    const expiresAt = fileExpiryDate();
    await ReportFile.insertMany(
      storedFiles.map((file, index) => ({
        order_id: order._id,
        uploaded_by_staff_id: req.user.id,
        report_type: REPORT_TYPES[index] || 'other',
        ...file,
        expires_at: expiresAt
      }))
    );

    order.order_status = 'report_uploaded';
    if (payload.ai_score !== undefined) {
      order.ai_score = payload.ai_score;
    }
    if (payload.similarity_score !== undefined) {
      order.similarity_score = payload.similarity_score;
    }
    await order.save();

    await logActivity({
      userId: req.user.id,
      orderId: order.id,
      action: 'report_uploaded',
      description: `${storedFiles.length} report file(s) uploaded for ${order.order_number}.`,
      ipAddress: req.ip
    });

    await notifyUser({
      userId: order.customer_id,
    orderId: order.id,
    type: 'report_uploaded',
    title: 'Reports uploaded',
    message: `Reports for ${order.order_number} have been uploaded and are ready to review.`,
    linkPath: ownerOrderPath(order)
  });

    res.status(201).json({ order: plain(order), reports: storedFiles });
  } catch (error) {
    await removeTempFiles(uploadedFiles);
    throw error;
  }
});

const markCompleted = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findById(orderId);

  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }
  if (!objectIdEquals(order.accepted_by_staff_id, req.user.id)) {
    throw new HttpError(403, 'You can complete only orders you accepted.');
  }
  if (order.order_status === 'completed') {
    throw new HttpError(400, 'This order is already completed.');
  }

  const reportCount = await ReportFile.countDocuments({ order_id: order._id });
  if (reportCount < REQUIRED_REPORT_FILE_COUNT) {
    throw new HttpError(400, 'Upload both report files before marking the order completed.');
  }

  const earningTotal = Number(order.file_count) * STAFF_RATE_PER_FILE_USD;
  order.order_status = 'completed';
  order.completed_at = new Date();
  await order.save();

  await StaffEarning.findOneAndUpdate(
    { order_id: order._id },
    {
      staff_id: req.user.id,
      order_id: order._id,
      completed_file_count: order.file_count,
      rate_per_file_usd: STAFF_RATE_PER_FILE_USD,
      total_earning_usd: earningTotal,
      status: 'unpaid'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_completed',
    description: `${order.order_number} completed. Staff earning USD ${earningTotal.toFixed(2)}.`,
    ipAddress: req.ip
  });

  await notifyUser({
    userId: order.customer_id,
    orderId: order.id,
    type: 'order_completed',
    title: 'Report checking completed',
    message: `${order.order_number} is complete. You can download your final reports now.`,
    linkPath: ownerOrderPath(order)
  });

  res.json({ order: plain(order) });
});

module.exports = {
  acceptOrder,
  availableOrders,
  completedOrders,
  dashboard,
  declineOrder,
  getOrderDetails,
  markCompleted,
  myOrders,
  releaseOrder,
  uploadReport
};
