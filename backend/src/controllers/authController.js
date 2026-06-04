const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../config/db');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  phone: z.string({ required_error: 'WhatsApp number is required.' })
    .trim()
    .min(7, 'WhatsApp number is required.')
    .max(40),
  password: z.string().min(8).max(120)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status
  };
}

const register = asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const email = payload.email.toLowerCase();

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const created = await query(
    `INSERT INTO users (name, email, phone, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'customer', 'active')
    `,
    [payload.name, email, payload.phone, passwordHash]
  );
  const result = await query(
    `SELECT id, name, email, phone, role, status
     FROM users
     WHERE id = $1`,
    [created.insertId]
  );

  const user = result.rows[0];
  await logActivity({
    userId: user.id,
    action: 'customer_registered',
    description: `${user.email} registered as a customer.`,
    ipAddress: req.ip
  });

  res.status(201).json({
    token: signToken(user),
    user: publicUser(user)
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const email = payload.email.toLowerCase();

  const result = await query(
    `SELECT id, name, email, phone, password_hash, role, status
     FROM users
     WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];
  const validPassword = user ? await bcrypt.compare(payload.password, user.password_hash) : false;
  if (!user || !validPassword) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  if (user.status !== 'active') {
    throw new HttpError(403, 'This account is inactive.');
  }

  await logActivity({
    userId: user.id,
    action: 'login',
    description: `${user.email} logged in.`,
    ipAddress: req.ip
  });

  res.json({
    token: signToken(user),
    user: publicUser(user)
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = {
  login,
  me,
  register
};
