const bcrypt = require('bcryptjs');
const { z } = require('zod');
const {
  ActivityLog,
  Order,
  OrderFile,
  ReportFile,
  StaffEarning,
  User
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { parseObjectId, plain, plainMany } = require('../utils/mongo');

const createStaffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120),
  status: z.enum(['active', 'inactive']).default('active')
});

const updateStaffSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional()
});

const statusSchema = z.object({
  status: z.enum(['active', 'inactive'])
});

async function userName(id) {
  if (!id) return null;
  const user = await User.findById(id).select('name email');
  return user ? { name: user.name, email: user.email } : null;
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
  const [totalOrders, totalCustomers, totalStaff, availableOrders, completedOrders, revenueRows, earningsRows, recent] =
    await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'staff' }),
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
      Order.find().sort({ created_at: -1 }).limit(8)
    ]);

  res.json({
    summary: {
      total_orders: totalOrders,
      total_customers: totalCustomers,
      total_staff: totalStaff,
      available_orders: availableOrders,
      completed_orders: completedOrders,
      total_revenue_lkr: revenueRows[0]?.total_revenue_lkr || 0,
      unpaid_staff_earnings_usd: earningsRows[0]?.unpaid_staff_earnings_usd || 0
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
        ...plain(customer),
        order_count: spend[0]?.order_count || 0,
        total_spend_lkr: spend[0]?.total_spend_lkr || 0
      };
    })
  );

  res.json({ customers: rows });
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ created_at: -1 });
  const rows = await Promise.all(
    staff.map(async (member) => {
      const [completedOrders, earning] = await Promise.all([
        Order.countDocuments({ accepted_by_staff_id: member._id, order_status: 'completed' }),
        StaffEarning.aggregate([
          { $match: { staff_id: member._id } },
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
        ...plain(member),
        completed_orders: completedOrders,
        completed_file_count: earning[0]?.completed_file_count || 0,
        total_earning_usd: earning[0]?.total_earning_usd || 0
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
    status: payload.status
  });

  await logActivity({
    userId: req.user.id,
    action: 'staff_created',
    description: `${staff.email} staff account created by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.status(201).json({ staff: plain(staff) });
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

  res.json({ staff: plain(current) });
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

  res.json({ staff: plain(staff) });
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

module.exports = {
  activityLogs,
  createStaff,
  dashboard,
  getOrderDetails,
  listCustomers,
  listOrders,
  listStaff,
  revenueSummary,
  staffEarnings,
  updateStaff,
  updateStaffStatus
};
