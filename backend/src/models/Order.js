const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const orderSchema = new Schema(
  {
    order_number: { type: String, required: true, unique: true },
    customer_package_id: { type: Types.ObjectId, ref: 'CustomerPackage' },
    customer_id: { type: Types.ObjectId, ref: 'User', required: true },
    service_type: { type: String, enum: ['similarity_only', 'ai_similarity'], required: true },
    file_count: { type: Number, required: true, min: 1 },
    price_per_file_lkr: { type: Number, required: true },
    total_amount_lkr: { type: Number, required: true },
    currency: { type: String, default: 'LKR' },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    },
    order_status: {
      type: String,
      enum: ['pending_payment', 'paid', 'available', 'accepted', 'checking', 'report_uploaded', 'completed', 'cancelled'],
      default: 'pending_payment'
    },
    accepted_by_staff_id: { type: Types.ObjectId, ref: 'User' },
    accepted_at: Date,
    completed_at: Date
  },
  schemaOptions({ createdAt: 'created_at', updatedAt: 'updated_at' })
);

orderSchema.index({ customer_id: 1 });
orderSchema.index({ customer_package_id: 1 });
orderSchema.index({ order_status: 1, payment_status: 1 });
orderSchema.index({ accepted_by_staff_id: 1 });

module.exports = model('Order', orderSchema);
