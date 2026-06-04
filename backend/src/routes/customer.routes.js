const express = require('express');
const {
  createOrder,
  dashboard,
  getOrderDetails,
  listOrders
} = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadOrderFiles } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(authenticate, authorize('customer'));

router.get('/dashboard', dashboard);
router.get('/orders', listOrders);
router.post('/orders', uploadLimiter, uploadOrderFiles, createOrder);
router.get('/orders/:id', getOrderDetails);

module.exports = router;
