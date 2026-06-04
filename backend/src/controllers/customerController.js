const { z } = require('zod');
const { pool, query } = require('../config/db');
const { PRICES_LKR } = require('../constants/pricing');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { generateOrderNumber } = require('../utils/orderNumber');
const { generatePackageNumber } = require('../utils/packageNumber');
const { removeTempFiles, storeUploadedFiles } = require('../utils/fileStorage');
const { notifyRole } = require('../utils/notificationService');

const createOrderSchema = z.object({
  service_type: z.literal('ai_similarity').optional().default('ai_similarity'),
  package_file_count: z.coerce.number().int().positive().optional(),
  package_id: z.coerce.number().int().positive().optional()
});

const allowedPackageCounts = new Set([1, 5, 10]);

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

const dashboard = asyncHandler(async (req, res) => {
  const [summary, recent, packages] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN order_status = 'available' THEN 1 ELSE 0 END) AS available_orders,
         SUM(CASE WHEN order_status IN ('accepted', 'checking', 'report_uploaded') THEN 1 ELSE 0 END) AS in_progress_orders,
         SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
         COALESCE(SUM(total_amount_lkr), 0) AS total_spend_lkr
       FROM orders
       WHERE customer_id = $1`,
      [req.user.id]
    ),
    query(
      `SELECT o.id, o.order_number, o.service_type, o.file_count, o.total_amount_lkr,
              o.payment_status, o.order_status, o.created_at,
              p.package_number
       FROM orders o
       LEFT JOIN customer_packages p ON p.id = o.customer_package_id
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [req.user.id]
    ),
    query(
      `SELECT id, package_number, package_file_count, used_file_count,
              (package_file_count - used_file_count) AS remaining_file_count,
              price_per_file_lkr, total_amount_lkr, status, created_at
       FROM customer_packages
       WHERE customer_id = $1
         AND payment_status = 'paid'
         AND status = 'active'
         AND used_file_count < package_file_count
       ORDER BY created_at DESC`,
      [req.user.id]
    )
  ]);

  res.json({
    summary: summary.rows[0],
    recent_orders: recent.rows,
    packages: packages.rows
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
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      let packageId = payload.package_id || null;
      let packageNumber = null;
      let remainingCredits = 0;
      let orderTotalAmount = 0;

      if (packageId) {
        const packageResult = await client.query(
          `SELECT id, package_number, package_file_count, used_file_count, status, payment_status
           FROM customer_packages
           WHERE id = $1 AND customer_id = $2
           FOR UPDATE`,
          [packageId, req.user.id]
        );
        const customerPackage = packageResult.rows[0];
        if (!customerPackage) {
          throw new HttpError(404, 'Package not found.');
        }
        if (customerPackage.status !== 'active' || customerPackage.payment_status !== 'paid') {
          throw new HttpError(400, 'This package cannot be used.');
        }

        remainingCredits =
          Number(customerPackage.package_file_count) - Number(customerPackage.used_file_count);
        if (fileCount > remainingCredits) {
          throw new HttpError(400, `This package has only ${remainingCredits} file credit(s) remaining.`);
        }
        packageNumber = customerPackage.package_number;
      } else {
        const packageFileCount = payload.package_file_count || fileCount;
        if (!allowedPackageCounts.has(packageFileCount)) {
          throw new HttpError(400, 'Select a valid package: 1, 5, or 10 files.');
        }
        if (fileCount > packageFileCount) {
          throw new HttpError(400, `Selected package allows only ${packageFileCount} file(s).`);
        }

        packageNumber = await generatePackageNumber(client);
        orderTotalAmount = pricePerFile * packageFileCount;
        const packageResult = await client.query(
          `INSERT INTO customer_packages (
             package_number, customer_id, service_type, package_file_count, used_file_count,
             price_per_file_lkr, total_amount_lkr, payment_status, status
           )
           VALUES ($1, $2, 'ai_similarity', $3, 0, $4, $5, 'paid', 'active')
          `,
          [packageNumber, req.user.id, packageFileCount, pricePerFile, orderTotalAmount]
        );
        packageId = packageResult.insertId;
        remainingCredits = packageFileCount;
      }

      const orderNumber = await generateOrderNumber(client);
      const createdOrder = await client.query(
        `INSERT INTO orders (
           order_number, customer_package_id, customer_id, service_type, file_count, price_per_file_lkr,
           total_amount_lkr, currency, payment_status, order_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'LKR', 'paid', 'available')
        `,
        [
          orderNumber,
          packageId,
          req.user.id,
          payload.service_type,
          fileCount,
          pricePerFile,
          orderTotalAmount
        ]
      );
      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [createdOrder.insertId]);

      const order = orderResult.rows[0];
      const storedFiles = await storeUploadedFiles(orderNumber, uploadedFiles, 'orders');

      for (const file of storedFiles) {
        await client.query(
          `INSERT INTO order_files (
             order_id, original_file_name, stored_file_name, file_path, file_type, file_size
           )
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            order.id,
            file.original_file_name,
            file.stored_file_name,
            file.file_path,
            file.file_type,
            file.file_size
          ]
        );
      }

      await client.query(
        `UPDATE customer_packages
         SET used_file_count = used_file_count + $1,
             status = CASE
               WHEN used_file_count + $1 >= package_file_count THEN 'used'
               ELSE 'active'
             END
         WHERE id = $2`,
        [fileCount, packageId]
      );
      const newUsedCount = await client.query(
        `SELECT package_file_count, used_file_count, status
         FROM customer_packages
         WHERE id = $1`,
        [packageId]
      );

      await logActivity({
        userId: req.user.id,
        orderId: order.id,
        action: 'order_created',
        description: `${order.order_number} created using package ${packageNumber}.`,
        ipAddress: req.ip,
        client
      });

      await notifyRole({
        role: 'staff',
        orderId: order.id,
        type: 'new_order_available',
        title: 'New order available',
        message: `${order.order_number} is ready to accept with ${fileCount} file(s).`,
        linkPath: '/staff/available-orders',
        client
      });

      await client.query('COMMIT');
      res.status(201).json({
        order,
        package: {
          id: packageId,
          package_number: packageNumber,
          package_file_count: newUsedCount.rows[0].package_file_count,
          used_file_count: newUsedCount.rows[0].used_file_count,
          status: newUsedCount.rows[0].status,
          remaining_file_count:
            Number(newUsedCount.rows[0].package_file_count) - Number(newUsedCount.rows[0].used_file_count)
        },
        files: storedFiles.map((file, index) => ({
          id: index + 1,
          original_file_name: file.original_file_name,
          file_size: file.file_size,
          file_type: file.file_type
        }))
      });
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

const listOrders = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.*, p.package_number,
            (SELECT COUNT(*) FROM report_files r WHERE r.order_id = o.id) AS report_count
     FROM orders o
     LEFT JOIN customer_packages p ON p.id = o.customer_package_id
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id);
  const orderResult = await query(
    `SELECT o.*, p.package_number, s.name AS staff_name
     FROM orders o
     LEFT JOIN customer_packages p ON p.id = o.customer_package_id
     LEFT JOIN users s ON s.id = o.accepted_by_staff_id
     WHERE o.id = $1 AND o.customer_id = $2`,
    [orderId, req.user.id]
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
      `SELECT id, original_file_name, file_type, file_size, uploaded_at
       FROM report_files
       WHERE order_id = $1
       ORDER BY uploaded_at DESC`,
      [orderId]
    )
  ]);

  res.json({
    order,
    files: files.rows,
    reports: reports.rows
  });
});

module.exports = {
  createOrder,
  dashboard,
  getOrderDetails,
  listOrders
};
