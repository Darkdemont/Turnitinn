const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const wholesalerPaymentBatchSchema = new Schema(
  {
    wholesaler_id: { type: Types.ObjectId, ref: 'User', required: true },
    cleared_by_admin_id: { type: Types.ObjectId, ref: 'User', required: true },
    file_count: { type: Number, required: true, min: 1 },
    amount_lkr: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    cleared_at: { type: Date, default: Date.now }
  },
  schemaOptions({ createdAt: 'created_at', updatedAt: 'updated_at' })
);

wholesalerPaymentBatchSchema.index({ wholesaler_id: 1, cleared_at: -1 });

module.exports = model('WholesalerPaymentBatch', wholesalerPaymentBatchSchema);
