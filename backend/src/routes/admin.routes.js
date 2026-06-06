const express = require('express');
const {
  activityLogs,
  createStaff,
  createWholesaler,
  clearWholesalerPayment,
  dashboard,
  getOrderDetails,
  listCustomers,
  listOrders,
  listStaff,
  listWholesalers,
  revenueSummary,
  staffEarnings,
  updateStaff,
  updateStaffStatus,
  updateWholesaler,
  updateWholesalerStatus
} = require('../controllers/adminController');
const {
  cleanupStorage,
  storageSummary
} = require('../controllers/adminStorageController');
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
router.get('/wholesalers', listWholesalers);
router.post('/wholesalers', createWholesaler);
router.patch('/wholesalers/:id', updateWholesaler);
router.patch('/wholesalers/:id/status', updateWholesalerStatus);
router.post('/wholesalers/:id/clear-payment', clearWholesalerPayment);
router.get('/staff-earnings', staffEarnings);
router.get('/revenue-summary', revenueSummary);
router.get('/activity-logs', activityLogs);
router.get('/storage', storageSummary);
router.post('/storage/cleanup', cleanupStorage);

module.exports = router;
