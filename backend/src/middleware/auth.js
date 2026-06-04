const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      throw new HttpError(401, 'Authentication required.');
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const result = await query(
      `SELECT id, name, email, phone, role, status
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    const user = result.rows[0];
    if (!user || user.status !== 'active') {
      throw new HttpError(401, 'Account is inactive or no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new HttpError(401, 'Invalid or expired token.'));
      return;
    }
    next(error);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'You do not have permission to access this resource.'));
      return;
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
