const { Notification, User } = require('../models');

async function notifyUser({ userId, orderId = null, type, title, message, linkPath = null }) {
  await Notification.create({
    user_id: userId,
    order_id: orderId,
    type,
    title,
    message,
    link_path: linkPath
  });
}

async function notifyRole({ role, orderId = null, type, title, message, linkPath = null }) {
  const users = await User.find({ role, status: 'active' }).select('_id');
  if (!users.length) return;

  await Notification.insertMany(
    users.map((user) => ({
      user_id: user._id,
      order_id: orderId,
      type,
      title,
      message,
      link_path: linkPath
    }))
  );
}

module.exports = {
  notifyRole,
  notifyUser
};
