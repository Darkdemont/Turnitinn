const crypto = require('crypto');
const { z } = require('zod');
const env = require('../config/env');
const { CustomerPackage, Order, OrderFile, ReportFile, User } = require('../models');
const { PRICES_LKR } = require('../constants/pricing');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { generateOrderNumber } = require('../utils/orderNumber');
const { generatePackageNumber } = require('../utils/packageNumber');
const { plain, plainMany, parseObjectId } = require('../utils/mongo');
const { removeStoredFile, removeTempFiles, resolveStoredFile, storeUploadedFiles } = require('../utils/fileStorage');
const { analyzeStoredFile } = require('../utils/documentAnalysis');
const { notifyRole } = require('../utils/notificationService');

const createOrderSchema = z.object({
  service_type: z.literal('ai_similarity').optional().default('ai_similarity'),
  package_file_count: z.coerce.number().int().positive().optional(),
  package_id: z.string().optional()
});

const allowedPackageCounts = new Set([1, 5, 10]);

function buildPayhereData({ order, user }) {
  const merchantId = env.payheremerchantId;
  const merchantSecret = env.payhereMerchantSecret;
  const amount = order.total_amount_lkr.toFixed(2);
  const currency = 'LKR';
  const orderId = order.order_number;

  let hash = '';
  if (merchantId && merchantSecret) {
    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    hash = crypto.createHash('md5')
      .update(`${merchantId}${orderId}${amount}${currency}${secretHash}`)
      .digest('hex')
      .toUpperCase();
  }

  const nameParts = (user.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || user.name || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '-';
  const baseUrl = env.publicAppUrl;
  const checkoutUrl = env.payhereSandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout';

  return {
    checkout_url: checkoutUrl,
    fields: {
      merchant_id: merchantId,
      return_url: `${baseUrl}/customer/payment/return`,
      cancel_url: `${baseUrl}/customer/payment/cancel`,
      notify_url: `${env.publicAppUrl.replace(/\/$/, '')}/api/payment/notify`,
      order_id: orderId,
      items: `AI + Similarity Check – ${order.file_count} file(s)`,
      currency,
      amount,
      first_name: firstName,
      last_name: lastName,
      email: user.email || '',
      phone: user.phone || '',
      address: 'N/A',
      city: 'Colombo',
      country: 'Sri Lanka',
      hash
    }
  };
}

function fileExpiryDate() {
  return new Date(Date.now() + env.fileRetentionHours * 60 * 60 * 1000);
}

async function packageNumberFor(packageId) {
  if (!packageId) return null;
  const row = await CustomerPackage.findById(packageId).select('package_number');
  return row?.package_number || null;
}

function activeFileFilter(orderId) {
  return {
    order_id: orderId,
    deleted_at: { $exists: false }
  };
}

function fileHistoryFilter(orderId) {
  return {
    order_id: orderId
  };
}

async function customerOrderSummary(order) {
  const [packageNumber, files, reports] = await Promise.all([
    packageNumberFor(order.customer_package_id),
    OrderFile.find(fileHistoryFilter(order._id)).sort({ _id: 1 }),
    ReportFile.find(fileHistoryFilter(order._id)).sort({ uploaded_at: -1 })
  ]);

  return {
    ...plain(order),
    package_number: packageNumber,
    files: plainMany(files),
    reports: plainMany(reports),
    report_count: reports.length
  };
}

const dashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [summaryRows, recentDocs, packages] = await Promise.all([
    Order.aggregate([
      { $match: { customer_id: parseObjectId(userId) } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          available_orders: { $sum: { $cond: [{ $eq: ['$order_status', 'available'] }, 1, 0] } },
          in_progress_orders: {
            $sum: {
              $cond: [{ $in: ['$order_status', ['accepted', 'checking', 'report_uploaded']] }, 1, 0]
            }
          },
          completed_orders: { $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, 1, 0] } },
          total_spend_lkr: { $sum: '$total_amount_lkr' }
        }
      }
    ]),
    Order.find({ customer_id: userId, order_status: { $ne: 'cancelled' } })
      .sort({ created_at: -1 })
      .limit(5)
      .select('order_number service_type file_count total_amount_lkr payment_status order_status created_at customer_package_id ai_score similarity_score'),
    CustomerPackage.find({
      customer_id: userId,
      payment_status: 'paid',
      status: 'active',
      $expr: { $lt: ['$used_file_count', '$package_file_count'] }
    }).sort({ created_at: -1 })
  ]);

  const recent_orders = await Promise.all(recentDocs.map(customerOrderSummary));

  res.json({
    summary: summaryRows[0] || {
      total_orders: 0,
      available_orders: 0,
      in_progress_orders: 0,
      completed_orders: 0,
      total_spend_lkr: 0
    },
    recent_orders,
    packages: plainMany(packages).map((row) => ({
      ...row,
      remaining_file_count: Number(row.package_file_count) - Number(row.used_file_count)
    }))
  });
});

const createOrder = asyncHandler(async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const payload = createOrderSchema.parse(req.body);
    if (!uploadedFiles.length) {
      throw new HttpError(400, 'Upload at least one assignment file.');
    }

    const pricePerFile = PRICES_LKR[payload.service_type];
    const fileCount = uploadedFiles.length;
    let packageId = payload.package_id ? parseObjectId(payload.package_id) : null;
    let packageNumber = null;
    let packageFileCount = payload.package_file_count || fileCount;
    let remainingCredits = 0;
    let orderTotalAmount = 0;

    const usingExistingBalance = Boolean(packageId);

    if (usingExistingBalance) {
      const customerPackage = await CustomerPackage.findOne({
        _id: packageId,
        customer_id: req.user.id
      });
      if (!customerPackage) {
        throw new HttpError(404, 'Package not found.');
      }
      if (customerPackage.status !== 'active' || customerPackage.payment_status !== 'paid') {
        throw new HttpError(400, 'This package cannot be used.');
      }

      remainingCredits = Number(customerPackage.package_file_count) - Number(customerPackage.used_file_count);
      if (fileCount > remainingCredits) {
        throw new HttpError(400, `This package has only ${remainingCredits} file credit(s) remaining.`);
      }
      packageNumber = customerPackage.package_number;
      packageFileCount = customerPackage.package_file_count;
    } else {
      if (!allowedPackageCounts.has(packageFileCount)) {
        throw new HttpError(400, 'Select a valid package: 1, 5, or 10 files.');
      }
      if (fileCount > packageFileCount) {
        throw new HttpError(400, `Selected package allows only ${packageFileCount} file(s).`);
      }

      packageNumber = await generatePackageNumber();
      orderTotalAmount = pricePerFile * packageFileCount;
      const customerPackage = await CustomerPackage.create({
        package_number: packageNumber,
        customer_id: req.user.id,
        service_type: 'ai_similarity',
        package_file_count: packageFileCount,
        used_file_count: 0,
        price_per_file_lkr: pricePerFile,
        total_amount_lkr: orderTotalAmount,
        payment_status: env.payheremerchantId ? 'pending' : 'paid',
        status: 'active'
      });
      packageId = customerPackage._id;
      remainingCredits = packageFileCount;
    }

    const needsPayment = !usingExistingBalance && Boolean(env.payheremerchantId);
    const orderNumber = await generateOrderNumber();
    const order = await Order.create({
      order_number: orderNumber,
      customer_package_id: packageId,
      customer_id: req.user.id,
      service_type: payload.service_type,
      file_count: fileCount,
      price_per_file_lkr: pricePerFile,
      total_amount_lkr: orderTotalAmount,
      currency: 'LKR',
      payment_status: needsPayment ? 'pending' : 'paid',
      order_status: needsPayment ? 'pending_payment' : 'available'
    });

    const storedFiles = await storeUploadedFiles(orderNumber, uploadedFiles, 'orders');
    const analyses = await Promise.all(
      storedFiles.map((file) => analyzeStoredFile(resolveStoredFile(file.file_path), file.original_file_name))
    );
    const expiresAt = fileExpiryDate();
    await OrderFile.insertMany(
      storedFiles.map((file, index) => ({
        order_id: order._id,
        ...file,
        ...analyses[index],
        expires_at: expiresAt
      }))
    );

    await logActivity({
      userId: req.user.id,
      orderId: order.id,
      action: 'order_created',
      description: `${order.order_number} created using package ${packageNumber}.`,
      ipAddress: req.ip
    });

    if (!needsPayment) {
      const usedCount = await CustomerPackage.findById(packageId);
      usedCount.used_file_count += fileCount;
      usedCount.status = usedCount.used_file_count >= usedCount.package_file_count ? 'used' : 'active';
      await usedCount.save();

      await notifyRole({
        role: 'staff',
        orderId: order.id,
        type: 'new_order_available',
        title: 'New order available',
        message: `${order.order_number} is ready to accept with ${fileCount} file(s).`,
        linkPath: '/staff/available-orders'
      });

      res.status(201).json({
        payment_required: false,
        order: plain(order),
        package: {
          id: usedCount.id,
          package_number: packageNumber,
          package_file_count: usedCount.package_file_count,
          used_file_count: usedCount.used_file_count,
          status: usedCount.status,
          remaining_file_count: Number(usedCount.package_file_count) - Number(usedCount.used_file_count)
        },
        files: storedFiles.map((file, index) => ({
          id: index + 1,
          original_file_name: file.original_file_name,
          file_size: file.file_size,
          file_type: file.file_type,
          expires_at: expiresAt,
          ...analyses[index]
        }))
      });
    } else {
      const user = await User.findById(req.user.id).select('name email phone');
      const payhere = buildPayhereData({ order, user });

      res.status(201).json({
        payment_required: true,
        order: plain(order),
        payhere,
        files: storedFiles.map((file, index) => ({
          id: index + 1,
          original_file_name: file.original_file_name,
          file_size: file.file_size,
          file_type: file.file_type,
          expires_at: expiresAt,
          ...analyses[index]
        }))
      });
    }
  } catch (error) {
    await removeTempFiles(uploadedFiles);
    throw error;
  }
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer_id: req.user.id }).sort({ created_at: -1 });
  const rows = await Promise.all(orders.map(customerOrderSummary));
  res.json({ orders: rows });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findOne({ _id: orderId, customer_id: req.user.id });
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const [files, reports, packageNumber] = await Promise.all([
    OrderFile.find(fileHistoryFilter(orderId)).sort({ _id: 1 }),
    ReportFile.find(fileHistoryFilter(orderId)).sort({ uploaded_at: -1 }),
    packageNumberFor(order.customer_package_id)
  ]);

  res.json({
    order: {
      ...plain(order),
      package_number: packageNumber
    },
    files: plainMany(files),
    reports: plainMany(reports)
  });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findOne({ _id: orderId, customer_id: req.user.id });
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }
  if (!['pending_payment', 'available'].includes(order.order_status)) {
    throw new HttpError(400, 'Only orders not yet accepted by staff can be cancelled.');
  }

  const files = await OrderFile.find(activeFileFilter(orderId));
  await Promise.all(files.map((file) => removeStoredFile(file.file_path)));
  await OrderFile.updateMany(
    activeFileFilter(orderId),
    { deleted_at: new Date(), delete_reason: 'customer_cancelled' }
  );

  if (order.customer_package_id) {
    const customerPackage = await CustomerPackage.findById(order.customer_package_id);
    if (customerPackage) {
      customerPackage.used_file_count = Math.max(
        0,
        Number(customerPackage.used_file_count || 0) - Number(order.file_count || 0)
      );
      customerPackage.status = customerPackage.used_file_count >= customerPackage.package_file_count ? 'used' : 'active';
      await customerPackage.save();
    }
  }

  order.order_status = 'cancelled';
  await order.save();

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_cancelled',
    description: `${order.order_number} cancelled by customer before staff accepted it.`,
    ipAddress: req.ip
  });

  res.json({ order: await customerOrderSummary(order) });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('name email phone created_at');
  if (!user) throw new HttpError(404, 'User not found.');

  const [stats] = await Order.aggregate([
    { $match: { customer_id: parseObjectId(req.user.id), order_status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        total_orders: { $sum: 1 },
        completed_orders: { $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, 1, 0] } },
        total_spend_lkr: { $sum: '$total_amount_lkr' }
      }
    }
  ]);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      created_at: user.created_at
    },
    stats: stats || { total_orders: 0, completed_orders: 0, total_spend_lkr: 0 }
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body || {};
  const update = {};
  if (name && typeof name === 'string') update.name = name.trim().slice(0, 120);
  if (typeof phone === 'string') update.phone = phone.trim().slice(0, 40);

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('name email phone');
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone || '' } });
});

module.exports = {
  cancelOrder,
  createOrder,
  dashboard,
  getOrderDetails,
  getProfile,
  listOrders,
  updateProfile
};
