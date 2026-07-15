const express = require('express');
const {
  activityLogs,
  addCustomerCredits,
  adminMarkOrderPaid,
  archiveWholesaler,
  clearCustomerData,
  clearStaffData,
  clearWholesalerData,
  createStaff,
  createWholesaler,
  clearWholesalerPayment,
  dashboard,
  getCustomerDetail,
  getOrderDetails,
  listCustomers,
  listOrders,
  listStaff,
  listWholesalers,
  restoreWholesaler,
  revenueSummary,
  staffEarnings,
  updateCustomerStatus,
  updateStaff,
  updateStaffStatus,
  updateWholesaler,
  updateWholesalerStatus
} = require('../controllers/adminController');
const {
  accountingSummary,
  markStaffPaid
} = require('../controllers/adminAccountingController');
const {
  cleanupStorage,
  storageSummary
} = require('../controllers/adminStorageController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', dashboard);
router.get('/accounting', accountingSummary);
router.post('/accounting/staff/:id/mark-paid', markStaffPaid);
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderDetails);
router.get('/customers', listCustomers);
router.get('/customers/:id', getCustomerDetail);
router.patch('/customers/:id/status', updateCustomerStatus);
router.post('/customers/:id/add-credits', addCustomerCredits);
router.post('/customers/:id/orders/:orderId/mark-paid', adminMarkOrderPaid);
router.post('/customers/:id/clear-data', clearCustomerData);
router.get('/staff', listStaff);
router.post('/staff', createStaff);
router.patch('/staff/:id', updateStaff);
router.patch('/staff/:id/status', updateStaffStatus);
router.post('/staff/:id/clear-data', clearStaffData);
router.get('/wholesalers', listWholesalers);
router.post('/wholesalers', createWholesaler);
router.patch('/wholesalers/:id', updateWholesaler);
router.patch('/wholesalers/:id/status', updateWholesalerStatus);
router.post('/wholesalers/:id/clear-payment', clearWholesalerPayment);
router.post('/wholesalers/:id/clear-data', clearWholesalerData);
router.post('/wholesalers/:id/archive', archiveWholesaler);
router.post('/wholesalers/:id/restore', restoreWholesaler);
router.get('/staff-earnings', staffEarnings);
router.get('/revenue-summary', revenueSummary);
router.get('/activity-logs', activityLogs);
router.get('/storage', storageSummary);
router.post('/storage/cleanup', cleanupStorage);

module.exports = router;
