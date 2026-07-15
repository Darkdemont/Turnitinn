const express = require('express');
const {
  cancelOrder,
  createOrder,
  dashboard,
  getOrderDetails,
  getProfile,
  listOrders,
  updateProfile
} = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadOrderFiles } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(authenticate, authorize('customer'));

router.get('/dashboard', dashboard);
router.get('/profile', getProfile);
router.post('/profile', updateProfile);
router.get('/orders', listOrders);
router.post('/orders', uploadLimiter, uploadOrderFiles, createOrder);
router.post('/orders/:id/cancel', cancelOrder);
router.get('/orders/:id', getOrderDetails);

module.exports = router;
