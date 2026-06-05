const fs = require('fs');
const { Order, OrderFile, ReportFile } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { objectIdEquals, parseObjectId } = require('../utils/mongo');
const { resolveStoredFile } = require('../utils/fileStorage');

function fileIsExpired(file) {
  return Boolean(file.deleted_at);
}

function canDownloadOrderFile(user, file, order) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return objectIdEquals(order.customer_id, user.id);
  if (user.role === 'staff') return objectIdEquals(order.accepted_by_staff_id, user.id);
  return false;
}

function canDownloadReportFile(user, file, order) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return objectIdEquals(order.customer_id, user.id);
  if (user.role === 'staff') {
    return objectIdEquals(order.accepted_by_staff_id, user.id) || objectIdEquals(file.uploaded_by_staff_id, user.id);
  }
  return false;
}

const downloadOrderFile = asyncHandler(async (req, res) => {
  const fileId = parseObjectId(req.params.id);
  const file = await OrderFile.findById(fileId);
  if (!file) {
    throw new HttpError(404, 'File not found.');
  }

  const order = await Order.findById(file.order_id);
  if (!order || !canDownloadOrderFile(req.user, file, order)) {
    throw new HttpError(403, 'You do not have access to this file.');
  }
  if (fileIsExpired(file)) {
    throw new HttpError(410, 'This uploaded file expired and was removed from storage.');
  }

  const absolutePath = resolveStoredFile(file.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'Stored file is missing.');
  }

  res.download(absolutePath, file.original_file_name);
});

const downloadReportFile = asyncHandler(async (req, res) => {
  const fileId = parseObjectId(req.params.id);
  const file = await ReportFile.findById(fileId);
  if (!file) {
    throw new HttpError(404, 'Report not found.');
  }

  const order = await Order.findById(file.order_id);
  if (!order || !canDownloadReportFile(req.user, file, order)) {
    throw new HttpError(403, 'You do not have access to this report.');
  }
  if (fileIsExpired(file)) {
    throw new HttpError(410, 'This report file expired and was removed from storage.');
  }

  const absolutePath = resolveStoredFile(file.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'Stored report is missing.');
  }

  res.download(absolutePath, file.original_file_name);
});

module.exports = {
  downloadOrderFile,
  downloadReportFile
};
