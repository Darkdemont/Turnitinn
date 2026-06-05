const { Schema, model } = require('mongoose');
const { schemaOptions } = require('./options');

const counterSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 }
  },
  schemaOptions(false)
);

module.exports = model('Counter', counterSchema);
