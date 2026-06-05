const bcrypt = require('bcryptjs');
const { closeDatabase, connectDatabase } = require('../config/db');
const models = require('../models');
const { Counter, User } = models;

async function seed() {
  await connectDatabase();
  await Promise.all(Object.values(models).map((Model) => Model.createIndexes()));

  await Counter.updateOne({ name: 'order_number' }, { $setOnInsert: { value: 0 } }, { upsert: true });
  await Counter.updateOne({ name: 'package_number' }, { $setOnInsert: { value: 0 } }, { upsert: true });

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const users = [
    {
      name: 'Admin User',
      email: 'admin@turnit.local',
      phone: '+94770000001',
      role: 'admin'
    },
    {
      name: 'Staff User',
      email: 'staff@turnit.local',
      phone: '+94770000002',
      role: 'staff'
    },
    {
      name: 'Customer User',
      email: 'customer@turnit.local',
      phone: '+94770000003',
      role: 'customer'
    }
  ];

  for (const user of users) {
    await User.updateOne(
      { email: user.email },
      {
        $set: {
          name: user.name,
          phone: user.phone,
          password_hash: passwordHash,
          role: user.role,
          status: 'active'
        }
      },
      { upsert: true }
    );
  }

  console.log('Seed complete.');
  console.log('Admin: admin@turnit.local / Password123!');
  console.log('Staff: staff@turnit.local / Password123!');
  console.log('Customer: customer@turnit.local / Password123!');
  await closeDatabase();
}

seed().catch(async (error) => {
  console.error(error);
  await closeDatabase();
  process.exit(1);
});
