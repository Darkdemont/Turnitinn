const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const activityLogSchema = new Schema(
  {
    user_id: { type: Types.ObjectId, ref: 'User' },
    order_id: { type: Types.ObjectId, ref: 'Order' },
    action: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true },
    ip_address: String,
    created_at: { type: Date, default: Date.now }
  },
  schemaOptions(false)
);

activityLogSchema.index({ created_at: -1 });
activityLogSchema.index({ user_id: 1 });
activityLogSchema.index({ order_id: 1 });

module.exports = model('ActivityLog', activityLogSchema);
