const express = require('express');
const {
  acceptOrder,
  availableOrders,
  completedOrders,
  dashboard,
  getOrderDetails,
  markCompleted,
  myOrders,
  uploadReport
} = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadReportFiles } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(authenticate, authorize('staff'));

router.get('/dashboard', dashboard);
router.get('/orders/available', availableOrders);
router.get('/orders/my', myOrders);
router.get('/orders/completed', completedOrders);
router.get('/orders/:id', getOrderDetails);
router.post('/orders/:id/accept', acceptOrder);
router.post('/orders/:id/reports', uploadLimiter, uploadReportFiles, uploadReport);
router.patch('/orders/:id/complete', markCompleted);

module.exports = router;
