const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

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

const dashboard = asyncHandler(async (req, res) => {
  const [counts, revenue, earnings, recent] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM orders) AS total_orders,
         (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
         (SELECT COUNT(*) FROM users WHERE role = 'staff') AS total_staff,
         (SELECT COUNT(*) FROM orders WHERE order_status = 'available') AS available_orders,
         (SELECT COUNT(*) FROM orders WHERE order_status = 'completed') AS completed_orders`
    ),
    query(
      `SELECT COALESCE(SUM(total_amount_lkr), 0) AS total_revenue_lkr
       FROM orders
       WHERE payment_status = 'paid'`
    ),
    query(
      `SELECT COALESCE(SUM(total_earning_usd), 0) AS unpaid_staff_earnings_usd
       FROM staff_earnings
       WHERE status = 'unpaid'`
    ),
    query(
      `SELECT o.id, o.order_number, o.service_type, o.file_count, o.total_amount_lkr,
              o.payment_status, o.order_status, o.created_at,
              c.name AS customer_name, s.name AS staff_name
       FROM orders o
       JOIN users c ON c.id = o.customer_id
       LEFT JOIN users s ON s.id = o.accepted_by_staff_id
       ORDER BY o.created_at DESC
       LIMIT 8`
    )
  ]);

  res.json({
    summary: {
      ...counts.rows[0],
      total_revenue_lkr: revenue.rows[0].total_revenue_lkr,
      unpaid_staff_earnings_usd: earnings.rows[0].unpaid_staff_earnings_usd
    },
    recent_orders: recent.rows
  });
});

const listOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email,
            s.name AS staff_name, s.email AS staff_email
     FROM orders o
     JOIN users c ON c.id = o.customer_id
     LEFT JOIN users s ON s.id = o.accepted_by_staff_id
     ORDER BY o.created_at DESC`
  );
  res.json({ orders: result.rows });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const orderResult = await query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email,
            s.name AS staff_name, s.email AS staff_email
     FROM orders o
     JOIN users c ON c.id = o.customer_id
     LEFT JOIN users s ON s.id = o.accepted_by_staff_id
     WHERE o.id = $1`,
    [orderId]
  );

  const order = orderResult.rows[0];
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const [files, reports] = await Promise.all([
    query(
      `SELECT id, original_file_name, file_type, file_size, uploaded_at
       FROM order_files
       WHERE order_id = $1
       ORDER BY id ASC`,
      [orderId]
    ),
    query(
      `SELECT r.id, r.original_file_name, r.file_type, r.file_size, r.uploaded_at,
              u.name AS uploaded_by_staff_name
       FROM report_files r
       JOIN users u ON u.id = r.uploaded_by_staff_id
       WHERE r.order_id = $1
       ORDER BY r.uploaded_at DESC`,
      [orderId]
    )
  ]);

  res.json({ order, files: files.rows, reports: reports.rows });
});

const listCustomers = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at,
            COUNT(o.id) AS order_count,
            COALESCE(SUM(o.total_amount_lkr), 0) AS total_spend_lkr
     FROM users u
     LEFT JOIN orders o ON o.customer_id = u.id
     WHERE u.role = 'customer'
     GROUP BY u.id, u.name, u.email, u.phone, u.status, u.created_at
     ORDER BY u.created_at DESC`
  );
  res.json({ customers: result.rows });
});

const listStaff = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at,
            COALESCE(o.completed_orders, 0) AS completed_orders,
            COALESCE(e.completed_file_count, 0) AS completed_file_count,
            COALESCE(e.total_earning_usd, 0) AS total_earning_usd
     FROM users u
     LEFT JOIN (
       SELECT accepted_by_staff_id AS staff_id, COUNT(*) AS completed_orders
       FROM orders
       WHERE order_status = 'completed'
       GROUP BY accepted_by_staff_id
     ) o ON o.staff_id = u.id
     LEFT JOIN (
       SELECT staff_id,
              SUM(completed_file_count) AS completed_file_count,
              SUM(total_earning_usd) AS total_earning_usd
       FROM staff_earnings
       GROUP BY staff_id
     ) e ON e.staff_id = u.id
     WHERE u.role = 'staff'
     ORDER BY u.created_at DESC`
  );
  res.json({ staff: result.rows });
});

const createStaff = asyncHandler(async (req, res) => {
  const payload = createStaffSchema.parse(req.body);
  const email = payload.email.toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    throw new HttpError(409, 'A user with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const created = await query(
    `INSERT INTO users (name, email, phone, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'staff', $5)`,
    [payload.name, email, payload.phone || null, passwordHash, payload.status]
  );
  const result = await query(
    `SELECT id, name, email, phone, role, status, created_at
     FROM users
     WHERE id = $1`,
    [created.insertId]
  );

  const staff = result.rows[0];
  await logActivity({
    userId: req.user.id,
    action: 'staff_created',
    description: `${staff.email} staff account created by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.status(201).json({ staff });
});

const updateStaff = asyncHandler(async (req, res) => {
  const staffId = parseId(req.params.id);
  const payload = updateStaffSchema.parse(req.body);
  const current = await query("SELECT id FROM users WHERE id = $1 AND role = 'staff'", [staffId]);
  if (!current.rows.length) {
    throw new HttpError(404, 'Staff member not found.');
  }

  const updates = [];
  const values = [];

  function add(field, value) {
    values.push(value);
    updates.push(`${field} = $${values.length}`);
  }

  if (payload.name !== undefined) add('name', payload.name);
  if (payload.email !== undefined) add('email', payload.email.toLowerCase());
  if (payload.phone !== undefined) add('phone', payload.phone || null);
  if (payload.status !== undefined) add('status', payload.status);
  if (payload.password !== undefined) {
    add('password_hash', await bcrypt.hash(payload.password, 12));
  }

  if (!updates.length) {
    throw new HttpError(400, 'No updates provided.');
  }

  values.push(staffId);
  await query(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${values.length} AND role = 'staff'`,
    values
  );
  const result = await query(
    `SELECT id, name, email, phone, role, status, created_at, updated_at
     FROM users
     WHERE id = $1 AND role = 'staff'`,
    [staffId]
  );

  await logActivity({
    userId: req.user.id,
    action: 'staff_updated',
    description: `${result.rows[0].email} staff account updated by ${req.user.email}.`,
    ipAddress: req.ip
  });

  res.json({ staff: result.rows[0] });
});

const updateStaffStatus = asyncHandler(async (req, res) => {
  const staffId = parseId(req.params.id);
  const payload = statusSchema.parse(req.body);
  await query(
    `UPDATE users
     SET status = $1
     WHERE id = $2 AND role = 'staff'`,
    [payload.status, staffId]
  );
  const result = await query(
    `SELECT id, name, email, phone, role, status, created_at, updated_at
     FROM users
     WHERE id = $1 AND role = 'staff'`,
    [staffId]
  );

  if (!result.rows.length) {
    throw new HttpError(404, 'Staff member not found.');
  }

  await logActivity({
    userId: req.user.id,
    action: 'staff_status_updated',
    description: `${result.rows[0].email} set to ${payload.status}.`,
    ipAddress: req.ip
  });

  res.json({ staff: result.rows[0] });
});

const staffEarnings = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id AS staff_id, u.name, u.email,
            COALESCE(SUM(e.completed_file_count), 0) AS completed_file_count,
            COALESCE(SUM(e.total_earning_usd), 0) AS total_earning_usd,
            COALESCE(SUM(CASE WHEN e.status = 'unpaid' THEN e.total_earning_usd ELSE 0 END), 0) AS unpaid_earning_usd,
            COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.total_earning_usd ELSE 0 END), 0) AS paid_earning_usd
     FROM users u
     LEFT JOIN staff_earnings e ON e.staff_id = u.id
     WHERE u.role = 'staff'
     GROUP BY u.id, u.name, u.email
     ORDER BY completed_file_count DESC, u.name ASC`
  );
  res.json({ staff_earnings: result.rows });
});

const revenueSummary = asyncHandler(async (req, res) => {
  const [summary, byService, byStatus] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_amount_lkr), 0) AS total_revenue_lkr,
         COALESCE(SUM(CASE WHEN order_status = 'completed' THEN total_amount_lkr ELSE 0 END), 0) AS completed_revenue_lkr
       FROM orders
       WHERE payment_status = 'paid'`
    ),
    query(
      `SELECT service_type, COUNT(*) AS order_count,
              COALESCE(SUM(file_count), 0) AS file_count,
              COALESCE(SUM(total_amount_lkr), 0) AS revenue_lkr
       FROM orders
       WHERE payment_status = 'paid'
       GROUP BY service_type
       ORDER BY service_type`
    ),
    query(
      `SELECT order_status, COUNT(*) AS order_count
       FROM orders
       GROUP BY order_status
       ORDER BY order_status`
    )
  ]);

  res.json({
    summary: summary.rows[0],
    by_service: byService.rows,
    by_status: byStatus.rows
  });
});

const activityLogs = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT l.id, l.action, l.description, l.ip_address, l.created_at,
            u.name AS user_name, u.email AS user_email, u.role AS user_role,
            o.order_number
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN orders o ON o.id = l.order_id
     ORDER BY l.created_at DESC
     LIMIT 200`
  );
  res.json({ activity_logs: result.rows });
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
