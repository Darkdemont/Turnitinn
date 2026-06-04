const express = require('express');
const {
  activityLogs,
  createStaff,
  dashboard,
  getOrderDetails,
  listCustomers,
  listOrders,
  listStaff,
  revenueSummary,
  staffEarnings,
  updateStaff,
  updateStaffStatus
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', dashboard);
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderDetails);
router.get('/customers', listCustomers);
router.get('/staff', listStaff);
router.post('/staff', createStaff);
router.patch('/staff/:id', updateStaff);
router.patch('/staff/:id/status', updateStaffStatus);
router.get('/staff-earnings', staffEarnings);
router.get('/revenue-summary', revenueSummary);
router.get('/activity-logs', activityLogs);

module.exports = router;
