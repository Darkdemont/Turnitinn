const { Counter } = require('../models');

async function generatePackageNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'package_number' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const sequence = String(counter.value).padStart(6, '0');
  const year = new Date().getFullYear();
  return `PKG-${year}-${sequence}`;
}

module.exports = {
  generatePackageNumber
};
