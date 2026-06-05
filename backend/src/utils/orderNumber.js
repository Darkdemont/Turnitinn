const { Counter } = require('../models');

async function generateOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'order_number' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const sequence = String(counter.value).padStart(6, '0');
  const year = new Date().getFullYear();
  return `ORD-${year}-${sequence}`;
}

module.exports = {
  generateOrderNumber
};
