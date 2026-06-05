const { Schema, model } = require('mongoose');
const { schemaOptions } = require('./options');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 180 },
    phone: { type: String, trim: true, maxlength: 40 },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  schemaOptions({ createdAt: 'created_at', updatedAt: 'updated_at' })
);

userSchema.index({ role: 1 });

module.exports = model('User', userSchema);
