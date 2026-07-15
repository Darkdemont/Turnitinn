const fs = require('fs');
const { Order, OrderFile, ReportFile, TempLink } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { generateOrderNumber } = require('../utils/orderNumber');
const { plain, plainMany } = require('../utils/mongo');
const { removeTempFiles, resolveStoredFile, storeUploadedFiles } = require('../utils/fileStorage');
const { notifyRole } = require('../utils/notificationService');

function isExpired(link) {
  return link.expires_at && new Date() > link.expires_at;
}

const getGuestOrder = asyncHandler(async (req, res) => {
  const link = await TempLink.findOne({ token: req.params.token });
  if (!link) throw new HttpError(404, 'This link does not exist or has expired.');
  if (link.status === 'revoked') throw new HttpError(410, 'This link has been revoked.');
  if (isExpired(link) && link.status === 'pending') {
    link.status = 'expired';
    await link.save();
  }
  if (link.status === 'expired') throw new HttpError(410, 'This link has expired.');

  const response = {
    token: link.token,
    file_slots: link.file_slots,
    service_type: link.service_type,
    note: link.note,
    status: link.status,
    expires_at: link.expires_at
  };

  if (link.order_id) {
    const [order, reports] = await Promise.all([
      Order.findById(link.order_id).select('order_number order_status file_count service_type ai_score similarity_score ai_skipped ai_skip_reason completed_at'),
      ReportFile.find({ order_id: link.order_id, deleted_at: { $exists: false } }).sort({ uploaded_at: 1 }).select('id original_file_name file_size uploaded_at report_type')
    ]);
    if (order) {
      response.order = plain(order);
      response.reports = plainMany(reports);
    }
  }

  res.json(response);
});

const uploadGuestFiles = asyncHandler(async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const link = await TempLink.findOne({ token: req.params.token });
    if (!link) throw new HttpError(404, 'This link does not exist.');
    if (link.status !== 'pending') throw new HttpError(409, 'Files have already been submitted for this link.');
    if (link.status === 'revoked') throw new HttpError(410, 'This link has been revoked.');
    if (isExpired(link)) throw new HttpError(410, 'This link has expired.');

    if (!uploadedFiles.length) throw new HttpError(400, 'Select at least one file to upload.');
    if (uploadedFiles.length > link.file_slots) {
      throw new HttpError(400, `This link allows up to ${link.file_slots} file${link.file_slots > 1 ? 's' : ''}.`);
    }

    const orderNumber = await generateOrderNumber();
    const order = await Order.create({
      order_number: orderNumber,
      account_type: 'guest',
      temp_link_id: link._id,
      service_type: link.service_type,
      file_count: uploadedFiles.length,
      price_per_file_lkr: 0,
      total_amount_lkr: 0,
      payment_status: 'paid',
      order_status: 'available'
    });

    const storedFiles = await storeUploadedFiles(orderNumber, uploadedFiles, 'orders');
    await OrderFile.insertMany(
      storedFiles.map((file) => ({
        order_id: order._id,
        ...file
      }))
    );

    link.order_id = order._id;
    link.status = 'uploaded';
    await link.save();

    await logActivity({
      orderId: order.id,
      action: 'guest_order_created',
      description: `Guest order ${orderNumber} created via temp link. ${uploadedFiles.length} file(s) uploaded.`,
      ipAddress: req.ip
    });

    await notifyRole({
      role: 'staff',
      orderId: order.id,
      type: 'new_order_available',
      title: 'New order available',
      message: `${orderNumber} is ready for checking.`,
      linkPath: `/staff/available-orders`
    });

    res.status(201).json({ order: plain(order), status: 'uploaded' });
  } catch (error) {
    await removeTempFiles(uploadedFiles);
    throw error;
  }
});

const downloadGuestReport = asyncHandler(async (req, res) => {
  const link = await TempLink.findOne({ token: req.params.token });
  if (!link || !link.order_id) throw new HttpError(404, 'Link or report not found.');
  if (link.status === 'revoked') throw new HttpError(410, 'This link has been revoked.');

  const report = await ReportFile.findOne({
    _id: req.params.reportId,
    order_id: link.order_id,
    deleted_at: { $exists: false }
  });
  if (!report) throw new HttpError(404, 'Report not found.');

  const absolutePath = resolveStoredFile(report.file_path);
  if (!fs.existsSync(absolutePath)) throw new HttpError(404, 'Report file is missing from storage.');

  res.download(absolutePath, report.original_file_name);
});

module.exports = {
  downloadGuestReport,
  getGuestOrder,
  uploadGuestFiles
};
