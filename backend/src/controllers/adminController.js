const bcrypt = require('bcryptjs');
const { z } = require('zod');
const {
  ActivityLog,
  Order,
  OrderFile,
  CustomerPackage,
  Notification,
  ReportFile,
  StaffEarning,
  User,
  WholesalerPaymentBatch
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { removeStoredFile } = require('../utils/fileStorage');
const { parseObjectId, plain, plainMany } = require('../utils/mongo');
const { STAFF_RATE_PER_FILE_USD } = require('../constants/pricing');

const createStaffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  rate_per_file_usd: z.coerce.number().min(0).default(STAFF_RATE_PER_FILE_USD)
});

const updateStaffSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  rate_per_file_usd: z.coerce.number().min(0).optional()
});

const createWholesalerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  rate_per_file_lkr: z.coerce.number().min(0).default(0)
});

const updateWholesalerSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  rate_per_file_lkr: z.coerce.number().min(0).optional()
});

const statusSchema = z.object({
  status: z.enum(['active', 'inactive'])
});

const clearWholesalerPaymentSchema = z.object({
  note: z.string().max(500).optional().nullable()
});

const activeStaffStatuses = ['accepted', 'checking', 'report_uploaded'];

async function userName(id) {
  if (!id) return null;
  const user = await User.findById(id).select('name email');
  return user ? { name: user.name, email: user.email } : null;
}

function accountPlain(user) {
  const row = plain(user);
  if (row) {
    delete row.password_hash;
  }
  return row;
}

async function removeStoredFilesForRows(rows) {
  let totalBytes = 0;
  await Promise.all(
    rows.map(async (file) => {
      totalBytes += Number(file.file_size || 0);
      if (!file.deleted_at) {
        await removeStoredFile(file.file_path);
      }
    })
  );
  return totalBytes;
}

async function purgeOrderFiles(orderIds, reason) {
  if (!orderIds.length) {
    return {
      order_file_count: 0,
      report_file_count: 0,
      cleared_bytes: 0
    };
  }

  const [orderFiles, reportFiles] = await Promise.all([
    OrderFile.find({ order_id: { $in: orderIds } }),
    ReportFile.find({ order_id: { $in: orderIds } })
  ]);

  const clearedBytes =
    (await removeStoredFilesForRows(orderFiles)) +
    (await removeStoredFilesForRows(reportFiles));

  await Promise.all([
    OrderFile.deleteMany({ order_id: { $in: orderIds } }),
    ReportFile.deleteMany({ order_id: { $in: orderIds } })
  ]);

  return {
    order_file_count: orderFiles.length,
    report_file_count: reportFiles.length,
    cleared_bytes: clearedBytes,
    reason
  };
}

async function clearOwnerData({ ownerId, accountType, reason }) {
  const orders = await Order.find({ customer_id: ownerId, account_type: accountType }).select('_id');
  const orderIds = orders.map((order) => order._id);
  const fileResult = await purgeOrderFiles(orderIds, reason);

  const [ordersDeleted, earningsDeleted, notificationsDeleted, packagesDeleted, batchesDeleted] =
    await Promise.all([
      Order.deleteMany({ _id: { $in: orderIds } }),
      StaffEarning.deleteMany({ order_id: { $in: orderIds } }),
      Notification.deleteMany({
        $or: [
          { user_id: ownerId },
          { order_id: { $in: orderIds } }
        ]
      }),
      accountType === 'customer'
        ? CustomerPackage.deleteMany({ customer_id: ownerId })
        : Promise.resolve({ deletedCount: 0 }),
      accountType === 'wholesaler'
        ? WholesalerPaymentBatch.deleteMany({ wholesaler_id: ownerId })
        : Promise.resolve({ deletedCount: 0 })
    ]);

  return {
    orders_deleted: ordersDeleted.deletedCount || 0,
    earnings_deleted: earningsDeleted.deletedCount || 0,
    notifications_deleted: notificationsDeleted.deletedCount || 0,
    packages_deleted: packagesDeleted.deletedCount || 0,
    payment_batches_deleted: batchesDeleted.deletedCount || 0,
    ...fileResult
  };
}

async function staffResetSummary(staffId) {
  const [completedOrders, earning] = await Promise.all([
    Order.countDocuments({ accepted_by_staff_id: staffId, order_status: 'completed' }),
    StaffEarning.aggregate([
      { $match: { staff_id: parseObjectId(staffId) } },
      {
        $group: {
          _id: null,
          completed_file_count: { $sum: '$completed_file_count' },
          total_earning_usd: { $sum: '$total_earning_usd' }
        }
      }
    ])
  ]);

  return {
    completed_orders: completedOrders,
    completed_file_count: earning[0]?.completed_file_count || 0,
    total_earning_usd: earning[0]?.total_earning_usd || 0
  };
}

async function wholesalerBillingSummary(wholesalerId) {
  const rows = await Order.aggregate([
    {
      $match: {
        customer_id: parseObjectId(wholesalerId),
        account_type: 'wholesaler',
        order_status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        total_orders: { $sum: 1 },
        submitted_file_count: { $sum: '$file_count' },
        completed_file_count: {
          $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, '$file_count', 0] }
        },
        unpaid_completed_file_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$order_status', 'completed'] },
                  { $eq: ['$wholesaler_payment_status', 'unpaid'] }
                ]
              },
              '$file_count',
              0
            ]
          }
        },
        unpaid_amount_lkr: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$order_status', 'completed'] },
                  { $eq: ['$wholesaler_payment_status', 'unpaid'] }
                ]
              },
              { $multiply: ['$file_count', '$price_per_file_lkr'] },
              0
            ]
          }
        }
      }
    }
  ]);

  return {
    total_orders: rows[0]?.total_orders || 0,
    submitted_file_count: rows[0]?.submitted_file_count || 0,
    completed_file_count: rows[0]?.completed_file_count || 0,
    unpaid_completed_file_count: rows[0]?.unpaid_completed_file_count || 0,
    unpaid_amount_lkr: rows[0]?.unpaid_amount_lkr || 0
  };
}

async function orderWithNames(order) {
  const [customer, staff] = await Promise.all([
    userName(order.customer_id),
    userName(order.accepted_by_staff_id)
  ]);

  return {
    ...plain(order),
    customer_name: customer?.name || null,
    customer_email: customer?.email || null,
    staff_name: staff?.name || null,
    staff_email: staff?.email || null
  };
}

const dashboard = asyncHandler(async (req, res) => {
  const [
    totalOrders,
    totalCustomers,
    totalStaff,
    totalWholesalers,
    availableOrders,
    completedOrders,
    revenueRows,
    earningsRows,
    wholesalerDueRows,
    recent
  ] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'staff' }),
    User.countDocuments({ role: 'wholesaler' }),
    Order.countDocuments({ order_status: 'available' }),
    Order.countDocuments({ order_status: 'completed' }),
    Order.aggregate([
      { $match: { payment_status: 'paid' } },
      { $group: { _id: null, total_revenue_lkr: { $sum: '$total_amount_lkr' } } }
    ]),
    StaffEarning.aggregate([
      { $match: { status: 'unpaid' } },
      { $group: { _id: null, unpaid_staff_earnings_usd: { $sum: '$total_earning_usd' } } }
    ]),
    Order.aggregate([
      {
        $match: {
          account_type: 'wholesaler',
          order_status: 'completed',
          wholesaler_payment_status: 'unpaid'
        }
      },
      {
        $group: {
          _id: null,
          unpaid_wholesaler_files: { $sum: '$file_count' },
          unpaid_wholesaler_amount_lkr: {
            $sum: { $multiply: ['$file_count', '$price_per_file_lkr'] }
          }
        }
      }
    ]),
    Order.find().sort({ created_at: -1 }).limit(8)
  ]);

  res.json({
    summary: {
      total_orders: totalOrders,
      total_customers: totalCustomers,
      total_staff: totalStaff,
      total_wholesalers: totalWholesalers,
      available_orders: availableOrders,
      completed_orders: completedOrders,
      total_revenue_lkr: revenueRows[0]?.total_revenue_lkr || 0,
      unpaid_staff_earnings_usd: earningsRows[0]?.unpaid_staff_earnings_usd || 0,
      unpaid_wholesaler_files: wholesalerDueRows[0]?.unpaid_wholesaler_files || 0,
      unpaid_wholesaler_amount_lkr: wholesalerDueRows[0]?.unpaid_wholesaler_amount_lkr || 0
    },
    recent_orders: await Promise.all(recent.map(orderWithNames))
  });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ created_at: -1 });
  res.json({ orders: await Promise.all(orders.map(orderWithNames)) });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.id);
  const order = await Order.findById(orderId);
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const [files, reports] = await Promise.all([
    OrderFile.find({ order_id: orderId }).sort({ _id: 1 }),
    ReportFile.find({ order_id: orderId }).sort({ uploaded_at: -1 })
  ]);

  const reportRows = await Promise.all(
    reports.map(async (report) => {
      const staff = await userName(report.uploaded_by_staff_id);
      return {
        ...plain(report),
        uploaded_by_staff_name: staff?.name || null
      };
    })
  );

  res.json({
    order: await orderWithNames(order),
    files: plainMany(files),
    reports: reportRows
  });
});

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await User.find({ role: 'customer' }).sort({ created_at: -1 });
  const rows = await Promise.all(
    customers.map(async (customer) => {
      const spend = await Order.aggregate([
        { $match: { customer_id: customer._id } },
        {
          $group: {
            _id: null,
            order_count: { $sum: 1 },
            total_spend_lkr: { $sum: '$total_amount_lkr' }
          }
        }
      ]);
      return {
        ...accountPlain(customer),
        order_count: spend[0]?.order_count || 0,
        total_spend_lkr: spend[0]?.total_spend_lkr || 0
      };
    })
  );

  res.json({ customers: rows });
});

const clearCustomerData = asyncHandler(async (req, res) => {
  const customerId = parseObjectId(req.params.id);
  const customer = await User.findOne({ _id: customerId, role: 'customer' });
  if (!customer) {
    throw new HttpError(404, 'Customer account not found.');
  }

  const result = await clearOwnerData({
    ownerId: customerId,
    accountType: 'customer',
    reason: 'admin_customer_reset'
  });

  await logActivity({
    userId: req.user.id,
    action: 'customer_data_cleared',
    description: `${req.user.email} cleared customer data for ${customer.email}: ${result.orders_deleted} order(s).`,
    ipAddress: req.ip
  });

  res.json({
    result,
    customer: {
      ...accountPlain(customer),
      order_count: 0,
      total_spend_lkr: 0
    }
  });
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ created_at: -1 });
  const rows = await Promise.all(
    staff.map(async (member) => {
      return {
        ...accountPlain(member),
        ...(await staffResetSummary(member._id))
      };
    })
  );

  res.json({ staff: rows });
});

const createStaff = asyncHandler(async (req, res) => {
  const payload = createStaffSchema.parse(req.body);
  const email = payload.email.toLowerCase();
  const existing = await User.exists({ email });
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists.');
  }

  const staff = await User.create({
    name: payload.name,
    email,
    phone: payload.phone || null,
    password_hash: await bcrypt.hash(payload.password, 12),
    role: 'staff',
    status: payload.status,
    rate_per_file_usd: payload.rate_per_file_usd
  });

  await logActivity({
    userId: req.user.id,
    action: 'staff_created',
    description: `${staff.email} staff account created by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.status(201).json({ staff: accountPlain(staff) });
});

const updateStaff = asyncHandler(async (req, res) => {
  const staffId = parseObjectId(req.params.id);
  const payload = updateStaffSchema.parse(req.body);
  const current = await User.findOne({ _id: staffId, role: 'staff' });
  if (!current) {
    throw new HttpError(404, 'Staff member not found.');
  }

  if (payload.email !== undefined) {
    const email = payload.email.toLowerCase();
    const duplicate = await User.exists({ email, _id: { $ne: staffId } });
    if (duplicate) {
      throw new HttpError(409, 'A user with this email already exists.');
    }
    current.email = email;
  }
  if (payload.name !== undefined) current.name = payload.name;
  if (payload.phone !== undefined) current.phone = payload.phone || null;
  if (payload.status !== undefined) current.status = payload.status;
  if (payload.rate_per_file_usd !== undefined) current.rate_per_file_usd = payload.rate_per_file_usd;
  if (payload.password !== undefined) current.password_hash = await bcrypt.hash(payload.password, 12);

  if (!Object.keys(payload).length) {
    throw new HttpError(400, 'No updates provided.');
  }

  await current.save();
  await logActivity({
    userId: req.user.id,
    action: 'staff_updated',
    description: `${current.email} staff account updated by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.json({ staff: accountPlain(current) });
});

const updateStaffStatus = asyncHandler(async (req, res) => {
  const staffId = parseObjectId(req.params.id);
  const payload = statusSchema.parse(req.body);
  const staff = await User.findOneAndUpdate(
    { _id: staffId, role: 'staff' },
    { status: payload.status },
    { new: true }
  );

  if (!staff) {
    throw new HttpError(404, 'Staff member not found.');
  }

  await logActivity({
    userId: req.user.id,
    action: 'staff_status_updated',
    description: `${staff.email} set to ${payload.status}.`,
    ipAddress: req.ip
  });

  res.json({ staff: accountPlain(staff) });
});

const clearStaffData = asyncHandler(async (req, res) => {
  const staffId = parseObjectId(req.params.id);
  const staff = await User.findOne({ _id: staffId, role: 'staff' });
  if (!staff) {
    throw new HttpError(404, 'Staff member not found.');
  }

  // Orders with reports already uploaded belong to whoever owns them (customer or
  // wholesaler) and must never be bounced/purged just because the staff member who
  // worked on them is being reset - only unstarted work (no reports yet) is releasable.
  const releasableOrders = await Order.find({
    accepted_by_staff_id: staffId,
    order_status: { $in: ['accepted', 'checking'] }
  }).select('_id');
  const reportsRetainedCount = await Order.countDocuments({
    accepted_by_staff_id: staffId,
    order_status: 'report_uploaded'
  });
  const completedOrders = await Order.find({
    accepted_by_staff_id: staffId,
    order_status: 'completed'
  }).select('_id');

  const releasableOrderIds = releasableOrders.map((order) => order._id);
  const completedOrderIds = completedOrders.map((order) => order._id);

  const [released, unassigned, declinesCleared, earningsDeleted, notificationsDeleted] = await Promise.all([
    Order.updateMany(
      { _id: { $in: releasableOrderIds } },
      {
        $set: { order_status: 'available' },
        $unset: {
          accepted_by_staff_id: '',
          accepted_at: '',
          ai_score: '',
          similarity_score: ''
        }
      }
    ),
    Order.updateMany(
      { _id: { $in: completedOrderIds } },
      {
        $unset: {
          accepted_by_staff_id: '',
          accepted_at: ''
        }
      }
    ),
    Order.updateMany(
      { declined_by_staff_ids: staffId },
      { $pull: { declined_by_staff_ids: staffId } }
    ),
    StaffEarning.deleteMany({ staff_id: staffId }),
    Notification.deleteMany({ user_id: staffId })
  ]);

  const result = {
    active_orders_released: released.modifiedCount || 0,
    completed_orders_unassigned: unassigned.modifiedCount || 0,
    orders_with_reports_retained: reportsRetainedCount,
    declined_orders_cleared: declinesCleared.modifiedCount || 0,
    earnings_deleted: earningsDeleted.deletedCount || 0,
    notifications_deleted: notificationsDeleted.deletedCount || 0,
    report_file_count: 0,
    cleared_bytes: 0
  };

  await logActivity({
    userId: req.user.id,
    action: 'staff_data_cleared',
    description: `${req.user.email} cleared staff data for ${staff.email}: ${result.active_orders_released} active order(s) released, ${result.completed_orders_unassigned} completed order(s) unassigned, ${result.orders_with_reports_retained} order(s) with reports left untouched.`,
    ipAddress: req.ip
  });

  res.json({
    result,
    staff: {
      ...accountPlain(staff),
      ...(await staffResetSummary(staff.id))
    }
  });
});

const listWholesalers = asyncHandler(async (req, res) => {
  const filter =
    req.query.view === 'archived'
      ? { role: 'wholesaler', archived_at: { $exists: true } }
      : { role: 'wholesaler', archived_at: { $exists: false } };
  const wholesalers = await User.find(filter).sort({ created_at: -1 });
  const rows = await Promise.all(
    wholesalers.map(async (wholesaler) => ({
      ...accountPlain(wholesaler),
      ...(await wholesalerBillingSummary(wholesaler.id))
    }))
  );

  res.json({ wholesalers: rows });
});

const createWholesaler = asyncHandler(async (req, res) => {
  const payload = createWholesalerSchema.parse(req.body);
  const email = payload.email.toLowerCase();
  const existing = await User.exists({ email });
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists.');
  }

  const wholesaler = await User.create({
    name: payload.name,
    email,
    phone: payload.phone || null,
    password_hash: await bcrypt.hash(payload.password, 12),
    role: 'wholesaler',
    status: payload.status,
    rate_per_file_lkr: payload.rate_per_file_lkr
  });

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_created',
    description: `${wholesaler.email} wholesaler account created by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.status(201).json({ wholesaler: accountPlain(wholesaler) });
});

const updateWholesaler = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const payload = updateWholesalerSchema.parse(req.body);
  const current = await User.findOne({ _id: wholesalerId, role: 'wholesaler' });
  if (!current) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  if (payload.email !== undefined) {
    const email = payload.email.toLowerCase();
    const duplicate = await User.exists({ email, _id: { $ne: wholesalerId } });
    if (duplicate) {
      throw new HttpError(409, 'A user with this email already exists.');
    }
    current.email = email;
  }
  if (payload.name !== undefined) current.name = payload.name;
  if (payload.phone !== undefined) current.phone = payload.phone || null;
  if (payload.status !== undefined) current.status = payload.status;
  if (payload.rate_per_file_lkr !== undefined) current.rate_per_file_lkr = payload.rate_per_file_lkr;
  if (payload.password !== undefined) current.password_hash = await bcrypt.hash(payload.password, 12);

  if (!Object.keys(payload).length) {
    throw new HttpError(400, 'No updates provided.');
  }

  await current.save();
  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_updated',
    description: `${current.email} wholesaler account updated by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.json({ wholesaler: accountPlain(current) });
});

const updateWholesalerStatus = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const payload = statusSchema.parse(req.body);
  const wholesaler = await User.findOneAndUpdate(
    { _id: wholesalerId, role: 'wholesaler' },
    { status: payload.status },
    { new: true }
  );

  if (!wholesaler) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_status_updated',
    description: `${wholesaler.email} set to ${payload.status}.`,
    ipAddress: req.ip
  });

  res.json({ wholesaler: accountPlain(wholesaler) });
});

const archiveWholesaler = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const wholesaler = await User.findOneAndUpdate(
    { _id: wholesalerId, role: 'wholesaler' },
    { status: 'inactive', archived_at: new Date() },
    { new: true }
  );

  if (!wholesaler) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_archived',
    description: `${req.user.email} deleted (archived) wholesaler ${wholesaler.email}. Login deactivated and hidden from the active list; order history is kept.`,
    ipAddress: req.ip
  });

  res.json({ wholesaler: accountPlain(wholesaler) });
});

const restoreWholesaler = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const wholesaler = await User.findOneAndUpdate(
    { _id: wholesalerId, role: 'wholesaler' },
    { $unset: { archived_at: '' } },
    { new: true }
  );

  if (!wholesaler) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_restored',
    description: `${req.user.email} restored wholesaler ${wholesaler.email} from deleted. Account is still inactive until reactivated.`,
    ipAddress: req.ip
  });

  res.json({ wholesaler: accountPlain(wholesaler) });
});

const clearWholesalerPayment = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const payload = clearWholesalerPaymentSchema.parse(req.body);
  const wholesaler = await User.findOne({ _id: wholesalerId, role: 'wholesaler' });
  if (!wholesaler) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  const unpaidOrders = await Order.find({
    customer_id: wholesalerId,
    account_type: 'wholesaler',
    order_status: 'completed',
    wholesaler_payment_status: 'unpaid'
  }).select('file_count price_per_file_lkr');

  if (!unpaidOrders.length) {
    throw new HttpError(400, 'No completed unpaid wholesaler files to clear.');
  }

  const fileCount = unpaidOrders.reduce((total, order) => total + Number(order.file_count || 0), 0);
  const amountLkr = unpaidOrders.reduce(
    (total, order) => total + Number(order.file_count || 0) * Number(order.price_per_file_lkr || 0),
    0
  );

  const batch = await WholesalerPaymentBatch.create({
    wholesaler_id: wholesalerId,
    cleared_by_admin_id: req.user.id,
    file_count: fileCount,
    amount_lkr: amountLkr,
    note: payload.note || null
  });

  await Order.updateMany(
    { _id: { $in: unpaidOrders.map((order) => order._id) } },
    {
      wholesaler_payment_status: 'paid',
      wholesaler_payment_batch_id: batch._id
    }
  );

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_payment_cleared',
    description: `${fileCount} completed file(s) cleared for ${wholesaler.email}.`,
    ipAddress: req.ip
  });

  res.json({
    batch: plain(batch),
    wholesaler: {
      ...accountPlain(wholesaler),
      ...(await wholesalerBillingSummary(wholesaler.id))
    }
  });
});

const clearWholesalerData = asyncHandler(async (req, res) => {
  const wholesalerId = parseObjectId(req.params.id);
  const wholesaler = await User.findOne({ _id: wholesalerId, role: 'wholesaler' });
  if (!wholesaler) {
    throw new HttpError(404, 'Wholesaler account not found.');
  }

  const result = await clearOwnerData({
    ownerId: wholesalerId,
    accountType: 'wholesaler',
    reason: 'admin_wholesaler_reset'
  });

  await logActivity({
    userId: req.user.id,
    action: 'wholesaler_data_cleared',
    description: `${req.user.email} cleared wholesaler data for ${wholesaler.email}: ${result.orders_deleted} order(s).`,
    ipAddress: req.ip
  });

  res.json({
    result,
    wholesaler: {
      ...accountPlain(wholesaler),
      ...(await wholesalerBillingSummary(wholesaler.id))
    }
  });
});

const staffEarnings = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ name: 1 });
  const rows = await Promise.all(
    staff.map(async (member) => {
      const totals = await StaffEarning.aggregate([
        { $match: { staff_id: member._id } },
        {
          $group: {
            _id: null,
            completed_file_count: { $sum: '$completed_file_count' },
            total_earning_usd: { $sum: '$total_earning_usd' },
            unpaid_earning_usd: {
              $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, '$total_earning_usd', 0] }
            },
            paid_earning_usd: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_earning_usd', 0] }
            }
          }
        }
      ]);

      return {
        staff_id: member.id,
        name: member.name,
        email: member.email,
        completed_file_count: totals[0]?.completed_file_count || 0,
        total_earning_usd: totals[0]?.total_earning_usd || 0,
        unpaid_earning_usd: totals[0]?.unpaid_earning_usd || 0,
        paid_earning_usd: totals[0]?.paid_earning_usd || 0
      };
    })
  );

  rows.sort((a, b) => b.completed_file_count - a.completed_file_count || a.name.localeCompare(b.name));
  res.json({ staff_earnings: rows });
});

const revenueSummary = asyncHandler(async (req, res) => {
  const [summaryRows, byService, byStatus] = await Promise.all([
    Order.aggregate([
      { $match: { payment_status: 'paid' } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          total_revenue_lkr: { $sum: '$total_amount_lkr' },
          completed_revenue_lkr: {
            $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, '$total_amount_lkr', 0] }
          }
        }
      }
    ]),
    Order.aggregate([
      { $match: { payment_status: 'paid' } },
      {
        $group: {
          _id: '$service_type',
          order_count: { $sum: 1 },
          file_count: { $sum: '$file_count' },
          revenue_lkr: { $sum: '$total_amount_lkr' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $group: { _id: '$order_status', order_count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  res.json({
    summary: summaryRows[0] || {
      total_orders: 0,
      total_revenue_lkr: 0,
      completed_revenue_lkr: 0
    },
    by_service: byService.map((row) => ({
      service_type: row._id,
      order_count: row.order_count,
      file_count: row.file_count,
      revenue_lkr: row.revenue_lkr
    })),
    by_status: byStatus.map((row) => ({ order_status: row._id, order_count: row.order_count }))
  });
});

const activityLogs = asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find().sort({ created_at: -1 }).limit(200);
  const rows = await Promise.all(
    logs.map(async (log) => {
      const [user, order] = await Promise.all([
        log.user_id ? User.findById(log.user_id).select('name email role') : null,
        log.order_id ? Order.findById(log.order_id).select('order_number') : null
      ]);

      return {
        ...plain(log),
        user_name: user?.name || null,
        user_email: user?.email || null,
        user_role: user?.role || null,
        order_number: order?.order_number || null
      };
    })
  );

  res.json({ activity_logs: rows });
});

const getCustomerDetail = asyncHandler(async (req, res) => {
  const customerId = parseObjectId(req.params.id);
  const customer = await User.findOne({ _id: customerId, role: 'customer' });
  if (!customer) throw new HttpError(404, 'Customer not found.');

  const [orders, packages, stats] = await Promise.all([
    Order.find({ customer_id: customerId }).sort({ created_at: -1 }).limit(50),
    CustomerPackage.find({ customer_id: customerId }).sort({ created_at: -1 }).limit(20),
    Order.aggregate([
      { $match: { customer_id: customerId } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          completed_orders: { $sum: { $cond: [{ $eq: ['$order_status', 'completed'] }, 1, 0] } },
          in_progress_orders: {
            $sum: { $cond: [{ $in: ['$order_status', ['accepted', 'checking', 'report_uploaded']] }, 1, 0] }
          },
          total_spend_lkr: { $sum: '$total_amount_lkr' }
        }
      }
    ])
  ]);

  res.json({
    customer: accountPlain(customer),
    stats: stats[0] || { total_orders: 0, completed_orders: 0, in_progress_orders: 0, total_spend_lkr: 0 },
    orders: plainMany(orders),
    packages: plainMany(packages)
  });
});

const updateCustomerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) {
    throw new HttpError(400, 'Status must be active or inactive.');
  }

  const customerId = parseObjectId(req.params.id);
  const customer = await User.findOneAndUpdate(
    { _id: customerId, role: 'customer' },
    { status },
    { new: true }
  );
  if (!customer) throw new HttpError(404, 'Customer not found.');

  await logActivity({
    userId: req.user.id,
    action: 'customer_status_updated',
    description: `${req.user.email} set customer ${customer.email} to ${status}.`,
    ipAddress: req.ip
  });

  res.json({ customer: accountPlain(customer) });
});

const addCustomerCredits = asyncHandler(async (req, res) => {
  const { file_count, note } = req.body || {};
  const count = Number(file_count);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new HttpError(400, 'file_count must be an integer between 1 and 100.');
  }

  const customerId = parseObjectId(req.params.id);
  const customer = await User.findOne({ _id: customerId, role: 'customer' });
  if (!customer) throw new HttpError(404, 'Customer not found.');

  const { generatePackageNumber } = require('../utils/packageNumber');
  const packageNumber = await generatePackageNumber();
  const pkg = await CustomerPackage.create({
    package_number: packageNumber,
    customer_id: customerId,
    service_type: 'ai_similarity',
    package_file_count: count,
    used_file_count: 0,
    price_per_file_lkr: 0,
    total_amount_lkr: 0,
    payment_status: 'paid',
    status: 'active'
  });

  await logActivity({
    userId: req.user.id,
    action: 'customer_credits_added',
    description: `${req.user.email} added ${count} file credit(s) to ${customer.email}${note ? `: ${note}` : ''}.`,
    ipAddress: req.ip
  });

  res.json({ package: plain(pkg) });
});

const adminMarkOrderPaid = asyncHandler(async (req, res) => {
  const orderId = parseObjectId(req.params.orderId);
  const customerId = parseObjectId(req.params.id);

  const order = await Order.findOne({ _id: orderId, customer_id: customerId });
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.payment_status === 'paid') throw new HttpError(400, 'Order is already paid.');

  order.payment_status = 'paid';
  order.order_status = 'available';
  await order.save();

  if (order.customer_package_id) {
    const pkg = await CustomerPackage.findById(order.customer_package_id);
    if (pkg && pkg.payment_status !== 'paid') {
      pkg.payment_status = 'paid';
      pkg.used_file_count = (Number(pkg.used_file_count) || 0) + Number(order.file_count || 0);
      pkg.status = pkg.used_file_count >= pkg.package_file_count ? 'used' : 'active';
      await pkg.save();
    }
  }

  const { notifyRole } = require('../utils/notificationService');
  await notifyRole({
    role: 'staff',
    orderId: order.id,
    type: 'new_order_available',
    title: 'New order available',
    message: `${order.order_number} is ready to accept with ${order.file_count} file(s).`,
    linkPath: '/staff/available-orders'
  });

  await logActivity({
    userId: req.user.id,
    orderId: order.id,
    action: 'order_manually_paid',
    description: `${req.user.email} manually marked ${order.order_number} as paid.`,
    ipAddress: req.ip
  });

  res.json({ order: plain(order) });
});

module.exports = {
  activityLogs,
  addCustomerCredits,
  adminMarkOrderPaid,
  archiveWholesaler,
  clearCustomerData,
  clearStaffData,
  clearWholesalerData,
  createStaff,
  createWholesaler,
  clearWholesalerPayment,
  dashboard,
  getCustomerDetail,
  getOrderDetails,
  listCustomers,
  listOrders,
  listStaff,
  listWholesalers,
  restoreWholesaler,
  revenueSummary,
  staffEarnings,
  updateCustomerStatus,
  updateStaff,
  updateStaffStatus,
  updateWholesaler,
  updateWholesalerStatus
};
