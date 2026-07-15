const express = require('express');
const { notify } = require('../controllers/paymentController');

const router = express.Router();

router.post('/notify', notify);

module.exports = router;
