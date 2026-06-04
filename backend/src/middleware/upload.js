const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const env = require('../config/env');
const { ensureUploadDirectories, isAllowedFile } = require('../utils/fileStorage');

ensureUploadDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(env.uploadRoot, 'temp'));
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `tmp-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: env.maxFilesPerOrder
  },
  fileFilter: (req, file, cb) => {
    if (!isAllowedFile(file.originalname)) {
      cb(new Error('Invalid file type. Allowed types: pdf, doc, docx, txt, zip.'));
      return;
    }
    cb(null, true);
  }
});

module.exports = {
  uploadOrderFiles: upload.array('files', env.maxFilesPerOrder),
  uploadReportFiles: upload.array('reports', env.maxFilesPerOrder)
};
