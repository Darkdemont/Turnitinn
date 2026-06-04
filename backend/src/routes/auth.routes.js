const express = require('express');
const { login, me, register } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
