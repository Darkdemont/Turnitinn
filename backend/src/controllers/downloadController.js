const fs = require('fs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { resolveStoredFile } = require('../utils/fileStorage');

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

function canDownloadOrderFile(user, file) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return file.customer_id === user.id;
  if (user.role === 'staff') return file.accepted_by_staff_id === user.id;
  return false;
}

function canDownloadReportFile(user, file) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return file.customer_id === user.id;
  if (user.role === 'staff') {
    return file.accepted_by_staff_id === user.id || file.uploaded_by_staff_id === user.id;
  }
  return false;
}

const downloadOrderFile = asyncHandler(async (req, res) => {
  const fileId = parseId(req.params.id);
  const result = await query(
    `SELECT f.*, o.customer_id, o.accepted_by_staff_id
     FROM order_files f
     JOIN orders o ON o.id = f.order_id
     WHERE f.id = $1`,
    [fileId]
  );

  const file = result.rows[0];
  if (!file) {
    throw new HttpError(404, 'File not found.');
  }
  if (!canDownloadOrderFile(req.user, file)) {
    throw new HttpError(403, 'You do not have access to this file.');
  }

  const absolutePath = resolveStoredFile(file.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'Stored file is missing.');
  }

  res.download(absolutePath, file.original_file_name);
});

const downloadReportFile = asyncHandler(async (req, res) => {
  const fileId = parseId(req.params.id);
  const result = await query(
    `SELECT r.*, o.customer_id, o.accepted_by_staff_id
     FROM report_files r
     JOIN orders o ON o.id = r.order_id
     WHERE r.id = $1`,
    [fileId]
  );

  const file = result.rows[0];
  if (!file) {
    throw new HttpError(404, 'Report not found.');
  }
  if (!canDownloadReportFile(req.user, file)) {
    throw new HttpError(403, 'You do not have access to this report.');
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
