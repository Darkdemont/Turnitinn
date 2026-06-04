const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

const listNotifications = asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 30, 60);
  const [notifications, unread] = await Promise.all([
    query(
      `SELECT id, order_id, type, title, message, link_path, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    ),
    query(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    )
  ]);

  res.json({
    notifications: notifications.rows,
    unread_count: unread.rows[0].count
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notificationId = parseId(req.params.id);
  await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE id = $1 AND user_id = $2`,
    [notificationId, req.user.id]
  );
  const result = await query(
    `SELECT id, order_id, type, title, message, link_path, read_at, created_at
     FROM notifications
     WHERE id = $1 AND user_id = $2`,
    [notificationId, req.user.id]
  );

  if (!result.rows.length) {
    throw new HttpError(404, 'Notification not found.');
  }

  res.json({ notification: result.rows[0] });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE user_id = $1 AND read_at IS NULL`,
    [req.user.id]
  );

  res.json({ ok: true });
});

module.exports = {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
};
