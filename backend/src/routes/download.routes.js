const express = require('express');
const {
  downloadOrderFile,
  downloadReportFile
} = require('../controllers/downloadController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/order-files/:id', downloadOrderFile);
router.get('/report-files/:id', downloadReportFile);

module.exports = router;
