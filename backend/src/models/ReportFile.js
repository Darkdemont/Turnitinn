const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const reportFileSchema = new Schema(
  {
    order_id: { type: Types.ObjectId, ref: 'Order', required: true },
    uploaded_by_staff_id: { type: Types.ObjectId, ref: 'User', required: true },
    report_type: { type: String, enum: ['similarity', 'ai', 'other'], default: 'other' },
    original_file_name: { type: String, required: true },
    stored_file_name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_type: String,
    file_size: { type: Number, required: true },
    uploaded_at: { type: Date, default: Date.now },
    expires_at: Date,
    deleted_at: Date,
    delete_reason: String
  },
  schemaOptions(false)
);

reportFileSchema.index({ order_id: 1 });
reportFileSchema.index({ uploaded_by_staff_id: 1 });
reportFileSchema.index({ expires_at: 1, deleted_at: 1 });

module.exports = model('ReportFile', reportFileSchema);
