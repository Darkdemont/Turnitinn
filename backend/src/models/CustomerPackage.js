const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const customerPackageSchema = new Schema(
  {
    package_number: { type: String, required: true, unique: true },
    customer_id: { type: Types.ObjectId, ref: 'User', required: true },
    service_type: { type: String, enum: ['ai_similarity'], default: 'ai_similarity' },
    package_file_count: { type: Number, required: true, min: 1 },
    used_file_count: { type: Number, default: 0, min: 0 },
    price_per_file_lkr: { type: Number, required: true },
    total_amount_lkr: { type: Number, required: true },
    currency: { type: String, default: 'LKR' },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'paid'
    },
    status: { type: String, enum: ['active', 'used', 'cancelled'], default: 'active' }
  },
  schemaOptions({ createdAt: 'created_at', updatedAt: 'updated_at' })
);

customerPackageSchema.index({ customer_id: 1, status: 1 });

module.exports = model('CustomerPackage', customerPackageSchema);
