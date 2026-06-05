const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { parseObjectId, plainMany, plain } = require('../utils/mongo');

const listNotifications = asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 30, 60);
  const [notifications, unread] = await Promise.all([
    Notification.find({ user_id: req.user.id }).sort({ created_at: -1 }).limit(limit),
    Notification.countDocuments({ user_id: req.user.id, read_at: null })
  ]);

  res.json({
    notifications: plainMany(notifications),
    unread_count: unread
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notificationId = parseObjectId(req.params.id);
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user_id: req.user.id },
    [{ $set: { read_at: { $ifNull: ['$read_at', '$$NOW'] } } }],
    { new: true }
  );

  if (!notification) {
    throw new HttpError(404, 'Notification not found.');
  }

  res.json({ notification: plain(notification) });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user_id: req.user.id, read_at: null },
    { read_at: new Date() }
  );

  res.json({ ok: true });
});

module.exports = {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
};
