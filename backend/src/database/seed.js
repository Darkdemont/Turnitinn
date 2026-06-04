const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seed() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  await pool.query(schemaSql);

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
    await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         status = 'active'`,
      [user.name, user.email, user.phone, passwordHash, user.role]
    );
  }

  console.log('Seed complete.');
  console.log('Admin: admin@turnit.local / Password123!');
  console.log('Staff: staff@turnit.local / Password123!');
  console.log('Customer: customer@turnit.local / Password123!');
  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
