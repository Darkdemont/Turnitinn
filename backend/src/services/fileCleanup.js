const env = require('../config/env');
const { OrderFile, ReportFile } = require('../models');
const { removeStoredFile } = require('../utils/fileStorage');

let timer = null;
let running = false;

async function expireFiles(Model, label) {
  const now = new Date();
  const files = await Model.find({
    deleted_at: null,
    expires_at: { $lte: now }
  }).limit(100);

  for (const file of files) {
    try {
      await removeStoredFile(file.file_path);
      file.deleted_at = now;
      file.delete_reason = 'expired';
      await file.save();
    } catch (error) {
      console.warn(`Could not expire ${label} file ${file.id}: ${error.message}`);
    }
  }

  return files.length;
}

async function runFileCleanup() {
  if (running) return;
  running = true;
  try {
    const [orderFiles, reportFiles] = await Promise.all([
      expireFiles(OrderFile, 'order'),
      expireFiles(ReportFile, 'report')
    ]);
    if (orderFiles || reportFiles) {
      console.log(`Expired ${orderFiles + reportFiles} stored file(s).`);
    }
  } finally {
    running = false;
  }
}

function startFileCleanup() {
  if (timer || env.fileRetentionHours <= 0) return;

  runFileCleanup().catch((error) => {
    console.warn(`Initial file cleanup failed: ${error.message}`);
  });

  timer = setInterval(() => {
    runFileCleanup().catch((error) => {
      console.warn(`File cleanup failed: ${error.message}`);
    });
  }, env.fileCleanupIntervalMinutes * 60 * 1000);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function stopFileCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  runFileCleanup,
  startFileCleanup,
  stopFileCleanup
};
