const express = require('express');
const {
  acceptOrder,
  availableOrders,
  completedOrders,
  dashboard,
  declineOrder,
  getOrderDetails,
  markCompleted,
  myOrders,
  releaseOrder,
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
router.post('/orders/:id/decline', declineOrder);
router.post('/orders/:id/release', releaseOrder);
router.post('/orders/:id/reports', uploadLimiter, uploadReportFiles, uploadReport);
router.post('/orders/:id/complete', markCompleted);

module.exports = router;
