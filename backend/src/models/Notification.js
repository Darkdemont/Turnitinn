const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const notificationSchema = new Schema(
  {
    user_id: { type: Types.ObjectId, ref: 'User', required: true },
    order_id: { type: Types.ObjectId, ref: 'Order' },
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 140 },
    message: { type: String, required: true },
    link_path: String,
    read_at: Date,
    created_at: { type: Date, default: Date.now }
  },
  schemaOptions(false)
);

notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, read_at: 1 });

module.exports = model('Notification', notificationSchema);
