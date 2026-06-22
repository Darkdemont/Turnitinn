const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const orderFileSchema = new Schema(
  {
    order_id: { type: Types.ObjectId, ref: 'Order', required: true },
    original_file_name: { type: String, required: true },
    stored_file_name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_type: String,
    file_size: { type: Number, required: true },
    uploaded_at: { type: Date, default: Date.now },
    expires_at: Date,
    deleted_at: Date,
    delete_reason: String,
    word_count: Number,
    language_warning: { type: Boolean, default: false },
    word_count_warning: { type: Boolean, default: false }
  },
  schemaOptions(false)
);

orderFileSchema.index({ order_id: 1 });
orderFileSchema.index({ expires_at: 1, deleted_at: 1 });

module.exports = model('OrderFile', orderFileSchema);
