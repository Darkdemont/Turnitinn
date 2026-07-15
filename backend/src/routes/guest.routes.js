const express = require('express');
const { downloadGuestReport, getGuestOrder, uploadGuestFiles } = require('../controllers/guestController');
const { uploadOrderFiles } = require('../middleware/upload');

const router = express.Router();

router.get('/:token', getGuestOrder);
router.post('/:token/upload', uploadOrderFiles, uploadGuestFiles);
router.get('/:token/download/:reportId', downloadGuestReport);

module.exports = router;
