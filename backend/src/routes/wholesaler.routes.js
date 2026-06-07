const express = require('express');
const {
  cancelOrder,
  createOrder,
  dashboard,
  getOrderDetails,
  listOrders
} = require('../controllers/wholesalerController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadOrderFiles } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(authenticate, authorize('wholesaler'));

router.get('/dashboard', dashboard);
router.get('/orders', listOrders);
router.post('/orders', uploadLimiter, uploadOrderFiles, createOrder);
router.patch('/orders/:id/cancel', cancelOrder);
router.get('/orders/:id', getOrderDetails);

module.exports = router;
