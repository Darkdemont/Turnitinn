const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const staffEarningSchema = new Schema(
  {
    staff_id: { type: Types.ObjectId, ref: 'User', required: true },
    order_id: { type: Types.ObjectId, ref: 'Order', required: true, unique: true },
    completed_file_count: { type: Number, required: true, min: 1 },
    rate_per_file_usd: { type: Number, default: 0.55 },
    total_earning_usd: { type: Number, required: true },
    status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    created_at: { type: Date, default: Date.now },
    paid_at: Date
  },
  schemaOptions(false)
);

staffEarningSchema.index({ staff_id: 1 });

module.exports = model('StaffEarning', staffEarningSchema);
