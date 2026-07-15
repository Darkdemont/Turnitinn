const crypto = require('crypto');
const { Schema, model, Types } = require('mongoose');
const { schemaOptions } = require('./options');

const tempLinkSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(5).toString('hex')
    },
    file_slots: { type: Number, required: true, min: 1, max: 10, default: 1 },
    service_type: { type: String, enum: ['similarity_only', 'ai_similarity'], required: true },
    note: { type: String, maxlength: 200 },
    order_id: { type: Types.ObjectId, ref: 'Order' },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'completed', 'expired', 'revoked'],
      default: 'pending'
    },
    created_by_admin_id: { type: Types.ObjectId, ref: 'User', required: true },
    expires_at: { type: Date, required: true }
  },
  schemaOptions({ createdAt: 'created_at', updatedAt: false })
);

tempLinkSchema.index({ expires_at: 1 });

module.exports = model('TempLink', tempLinkSchema);
