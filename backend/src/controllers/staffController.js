const { pool, query } = require('../config/db');
const env = require('../config/env');
const { STAFF_RATE_PER_FILE_USD } = require('../constants/pricing');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { removeTempFiles, storeUploadedFiles } = require('../utils/fileStorage');
const { notifyUser } = require('../utils/notificationService');

const REQUIRED_REPORT_FILE_COUNT = 2;
const ACTIVE_STAFF_STATUSES = ['accepted', 'checking', 'report_uploaded'];

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

const dashboard = asyncHandler(async (req, res) => {
  const [available, active, completed, earnings, recent] = await Promise.all([
    query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE order_status = 'available' AND payment_status = 'paid' AND accepted_by_staff_id IS NULL`
    ),
    query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE accepted_by_staff_id = $1 AND order_status IN ('accepted', 'checking', 'report_uploaded')`,
      [req.user.id]
    ),
    query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE accepted_by_staff_id = $1 AND order_status = 'completed'`,
      [req.user.id]
    ),
    query(
      `SELECT
         COALESCE(SUM(completed_file_count), 0) AS total_completed_files,
         COALESCE(SUM(total_earning_usd), 0) AS total_earning_usd
       FROM staff_earnings
       WHERE staff_id = $1`,
      [req.user.id]
    ),
    query(
      `SELECT id, order_number, service_type, file_count, order_status, accepted_at, completed_at
       FROM orders
       WHERE accepted_by_staff_id = $1
       ORDER BY updated_at DESC
       LIMIT 5`,
      [req.user.id]
    )
  ]);

  res.json({
    summary: {
      available_orders: available.rows[0].count,
      my_active_orders: active.rows[0].count,
      max_active_orders: env.staffMaxActiveOrders,
      remaining_accept_slots: Math.max(0, env.staffMaxActiveOrders - active.rows[0].count),
      my_completed_orders: completed.rows[0].count,
      total_completed_files: earnings.rows[0].total_completed_files,
      total_earning_usd: earnings.rows[0].total_earning_usd
    },
    recent_orders: recent.rows
  });
});

const availableOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.id, o.order_number, o.service_type, o.file_count,
            o.payment_status, o.order_status, o.created_at
     FROM orders o
     WHERE o.order_status = 'available'
       AND o.payment_status = 'paid'
       AND o.accepted_by_staff_id IS NULL
     ORDER BY o.created_at ASC`
  );
  res.json({ orders: result.rows });
});

const myOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.id, o.order_number, o.service_type, o.file_count,
            o.payment_status, o.order_status, o.accepted_at, o.completed_at, o.updated_at,
            (SELECT COUNT(*) FROM report_files r WHERE r.order_id = o.id) AS report_count
     FROM orders o
     WHERE o.accepted_by_staff_id = $1
     ORDER BY o.updated_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

const completedOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.id, o.order_number, o.service_type, o.file_count, o.completed_at,
            e.total_earning_usd
     FROM orders o
     LEFT JOIN staff_earnings e ON e.order_id = o.id
     WHERE o.accepted_by_staff_id = $1 AND o.order_status = 'completed'
     ORDER BY o.completed_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

const acceptOrder = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const lockName = `staff_accept_${req.user.id}`;
    const lock = await client.query('SELECT GET_LOCK($1, 10) AS lock_acquired', [lockName]);
    if (lock.rows[0].lock_acquired !== 1) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'Could not lock this staff account. Please try again.');
    }

    const activeCount = await client.query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE accepted_by_staff_id = $1
         AND order_status IN ($2, $3, $4)`,
      [req.user.id, ...ACTIVE_STAFF_STATUSES]
    );

    if (activeCount.rows[0].count >= env.staffMaxActiveOrders) {
      await client.query('ROLLBACK');
      throw new HttpError(
        409,
        `You already have ${env.staffMaxActiveOrders} active orders. Complete one before accepting another order.`
      );
    }

    const result = await client.query(
      `UPDATE orders
       SET accepted_by_staff_id = $1,
           accepted_at = CURRENT_TIMESTAMP,
           order_status = 'accepted'
       WHERE id = $2
         AND order_status = 'available'
         AND accepted_by_staff_id IS NULL`,
      [req.user.id, orderId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      await client.query('SELECT RELEASE_LOCK($1)', [lockName]);
      throw new HttpError(409, 'This order was already accepted by another staff member.');
    }

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderResult.rows[0];
    await logActivity({
      userId: req.user.id,
      orderId: order.id,
      action: 'order_accepted',
      description: `${order.order_number} accepted by ${req.user.email}.`,
      ipAddress: req.ip,
      client
    });

    await notifyUser({
      userId: order.customer_id,
      orderId: order.id,
      type: 'order_accepted',
      title: 'Order accepted',
      message: `${order.order_number} has been accepted and will be checked soon.`,
      linkPath: `/customer/orders/${order.id}`,
      client
    });

    await client.query('COMMIT');
    await client.query('SELECT RELEASE_LOCK($1)', [lockName]);
    res.json({ order });
  } catch (error) {
    if (!error.statusCode) {
      await client.query('ROLLBACK');
    }
    await client.query('SELECT RELEASE_LOCK($1)', [`staff_accept_${req.user.id}`]).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const orderResult = await query(
    `SELECT id, order_number, service_type, file_count, payment_status, order_status,
            accepted_by_staff_id, accepted_at, completed_at, created_at, updated_at
     FROM orders o
     WHERE o.id = $1
       AND (o.order_status = 'available' OR o.accepted_by_staff_id = $2)`,
    [orderId, req.user.id]
  );

  const order = orderResult.rows[0];
  if (!order) {
    throw new HttpError(404, 'Order not found.');
  }

  const canViewFiles = order.accepted_by_staff_id === req.user.id;
  const [files, reports] = await Promise.all([
    canViewFiles
      ? query(
          `SELECT id, original_file_name, file_type, file_size, uploaded_at
           FROM order_files
           WHERE order_id = $1
           ORDER BY id ASC`,
          [orderId]
        )
      : Promise.resolve({ rows: [] }),
    query(
      `SELECT id, original_file_name, file_type, file_size, uploaded_at
       FROM report_files
       WHERE order_id = $1 AND uploaded_by_staff_id = $2
       ORDER BY uploaded_at DESC`,
      [orderId, req.user.id]
    )
  ]);

  res.json({
    order,
    files: files.rows,
    reports: reports.rows,
    can_download_order_files: canViewFiles
  });
});

const uploadReport = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const uploadedFiles = req.files || [];

  try {
    if (!uploadedFiles.length) {
      throw new HttpError(400, 'Upload at least one final report file.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query(
        `SELECT id, order_number, customer_id, file_count, service_type, accepted_by_staff_id, order_status
         FROM orders
         WHERE id = $1`,
        [orderId]
      );

      const order = orderResult.rows[0];
      if (!order) {
        throw new HttpError(404, 'Order not found.');
      }
      if (order.accepted_by_staff_id !== req.user.id) {
        throw new HttpError(403, 'You can upload reports only for orders you accepted.');
      }
      if (order.order_status === 'completed' || order.order_status === 'cancelled') {
        throw new HttpError(400, 'This order can no longer receive reports.');
      }
      if (order.service_type === 'ai_similarity' && uploadedFiles.length !== REQUIRED_REPORT_FILE_COUNT) {
        throw new HttpError(400, 'Upload both report files: similarity report and AI report.');
      }

      const storedFiles = await storeUploadedFiles(order.order_number, uploadedFiles, 'reports');
      for (const file of storedFiles) {
        await client.query(
          `INSERT INTO report_files (
             order_id, uploaded_by_staff_id, original_file_name, stored_file_name,
             file_path, file_type, file_size
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            order.id,
            req.user.id,
            file.original_file_name,
            file.stored_file_name,
            file.file_path,
            file.file_type,
            file.file_size
          ]
        );
      }

      await client.query(
        `UPDATE orders
         SET order_status = 'report_uploaded'
         WHERE id = $1`,
        [order.id]
      );
      const updated = await client.query('SELECT * FROM orders WHERE id = $1', [order.id]);

      await logActivity({
        userId: req.user.id,
        orderId: order.id,
        action: 'report_uploaded',
        description: `${storedFiles.length} report file(s) uploaded for ${order.order_number}.`,
        ipAddress: req.ip,
        client
      });

      await notifyUser({
        userId: order.customer_id,
        orderId: order.id,
        type: 'report_uploaded',
        title: 'Reports uploaded',
        message: `Reports for ${order.order_number} have been uploaded and are ready to review.`,
        linkPath: `/customer/orders/${order.id}`,
        client
      });

      await client.query('COMMIT');
      res.status(201).json({ order: updated.rows[0], reports: storedFiles });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await removeTempFiles(uploadedFiles);
    throw error;
  }
});

const markCompleted = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, order_number, customer_id, file_count, order_status, accepted_by_staff_id
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderResult.rows[0];
    if (!order) {
      throw new HttpError(404, 'Order not found.');
    }
    if (order.accepted_by_staff_id !== req.user.id) {
      throw new HttpError(403, 'You can complete only orders you accepted.');
    }
    if (order.order_status === 'completed') {
      throw new HttpError(400, 'This order is already completed.');
    }

    const reportCount = await client.query(
      'SELECT COUNT(*) AS count FROM report_files WHERE order_id = $1',
      [order.id]
    );
    if (reportCount.rows[0].count < REQUIRED_REPORT_FILE_COUNT) {
      throw new HttpError(400, 'Upload both report files before marking the order completed.');
    }

    const earningTotal = Number(order.file_count) * STAFF_RATE_PER_FILE_USD;
    await client.query(
      `UPDATE orders
       SET order_status = 'completed',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id]
    );
    const completed = await client.query('SELECT * FROM orders WHERE id = $1', [order.id]);

    await client.query(
      `INSERT INTO staff_earnings (
         staff_id, order_id, completed_file_count, rate_per_file_usd, total_earning_usd, status
       )
       VALUES ($1, $2, $3, $4, $5, 'unpaid')
       ON DUPLICATE KEY UPDATE
         staff_id = VALUES(staff_id),
         completed_file_count = VALUES(completed_file_count),
         rate_per_file_usd = VALUES(rate_per_file_usd),
         total_earning_usd = VALUES(total_earning_usd)`,
      [req.user.id, order.id, order.file_count, STAFF_RATE_PER_FILE_USD, earningTotal]
    );

    await logActivity({
      userId: req.user.id,
      orderId: order.id,
      action: 'order_completed',
      description: `${order.order_number} completed. Staff earning USD ${earningTotal.toFixed(2)}.`,
      ipAddress: req.ip,
      client
    });

    await notifyUser({
      userId: order.customer_id,
      orderId: order.id,
      type: 'order_completed',
      title: 'Report checking completed',
      message: `${order.order_number} is complete. You can download your final reports now.`,
      linkPath: `/customer/orders/${order.id}`,
      client
    });

    await client.query('COMMIT');
    res.json({ order: completed.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = {
  acceptOrder,
  availableOrders,
  completedOrders,
  dashboard,
  getOrderDetails,
  markCompleted,
  myOrders,
  uploadReport
};
