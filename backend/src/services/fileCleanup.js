const env = require('../config/env');
const { OrderFile, ReportFile } = require('../models');
const { removeStoredFile } = require('../utils/fileStorage');

let timer = null;
let running = false;

function activeFileFilter(extra = {}) {
  return {
    deleted_at: null,
    ...extra
  };
}

async function summarizeFiles(Model, label) {
  const now = new Date();
  const [activeRows, expiredRows, deletedRows] = await Promise.all([
    Model.aggregate([
      { $match: activeFileFilter() },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$file_size' } } }
    ]),
    Model.aggregate([
      { $match: activeFileFilter({ expires_at: { $lte: now } }) },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$file_size' } } }
    ]),
    Model.aggregate([
      { $match: { deleted_at: { $exists: true, $ne: null } } },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$file_size' } } }
    ])
  ]);

  return {
    label,
    active_files: activeRows[0]?.count || 0,
    active_bytes: activeRows[0]?.bytes || 0,
    expired_files: expiredRows[0]?.count || 0,
    expired_bytes: expiredRows[0]?.bytes || 0,
    deleted_records: deletedRows[0]?.count || 0,
    deleted_record_bytes: deletedRows[0]?.bytes || 0
  };
}

async function clearFilesForModel(Model, label, filter, reason, now) {
  const result = {
    label,
    cleared_files: 0,
    cleared_bytes: 0,
    failed_files: 0
  };

  const cursor = Model.find(filter).cursor();
  for await (const file of cursor) {
    try {
      await removeStoredFile(file.file_path);
      file.deleted_at = now;
      file.delete_reason = reason;
      await file.save();
      result.cleared_files += 1;
      result.cleared_bytes += Number(file.file_size || 0);
    } catch (error) {
      result.failed_files += 1;
      console.warn(`Could not clear ${label} file ${file.id}: ${error.message}`);
    }
  }

  return result;
}

function cleanupFilter(mode, olderThanHours, now) {
  if (mode === 'all') {
    return activeFileFilter();
  }

  if (mode === 'older_than') {
    const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
    return activeFileFilter({ uploaded_at: { $lte: cutoff } });
  }

  return activeFileFilter({ expires_at: { $lte: now } });
}

async function getFileStorageSummary() {
  const [orderFiles, reportFiles] = await Promise.all([
    summarizeFiles(OrderFile, 'order'),
    summarizeFiles(ReportFile, 'report')
  ]);

  return {
    retention_hours: env.fileRetentionHours,
    cleanup_interval_minutes: env.fileCleanupIntervalMinutes,
    categories: {
      order_files: orderFiles,
      report_files: reportFiles
    },
    totals: {
      active_files: orderFiles.active_files + reportFiles.active_files,
      active_bytes: orderFiles.active_bytes + reportFiles.active_bytes,
      expired_files: orderFiles.expired_files + reportFiles.expired_files,
      expired_bytes: orderFiles.expired_bytes + reportFiles.expired_bytes,
      deleted_records: orderFiles.deleted_records + reportFiles.deleted_records,
      deleted_record_bytes: orderFiles.deleted_record_bytes + reportFiles.deleted_record_bytes
    }
  };
}

async function clearStoredFiles({ mode = 'expired', olderThanHours = env.fileRetentionHours, reason } = {}) {
  const now = new Date();
  const filter = cleanupFilter(mode, olderThanHours, now);
  const deleteReason = reason || (mode === 'all' ? 'admin_cleared_all' : `admin_cleared_${mode}`);

  const [orderFiles, reportFiles] = await Promise.all([
    clearFilesForModel(OrderFile, 'order', filter, deleteReason, now),
    clearFilesForModel(ReportFile, 'report', filter, deleteReason, now)
  ]);

  return {
    mode,
    older_than_hours: mode === 'older_than' ? olderThanHours : null,
    order_files: orderFiles,
    report_files: reportFiles,
    total_files: orderFiles.cleared_files + reportFiles.cleared_files,
    total_bytes: orderFiles.cleared_bytes + reportFiles.cleared_bytes,
    failed_files: orderFiles.failed_files + reportFiles.failed_files
  };
}

async function runFileCleanup() {
  if (running) return;
  running = true;
  try {
    const result = await clearStoredFiles({
      mode: 'expired',
      reason: 'expired'
    });
    if (result.total_files) {
      console.log(`Expired ${result.total_files} stored file(s).`);
    }
    return result;
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
  clearStoredFiles,
  getFileStorageSummary,
  runFileCleanup,
  startFileCleanup,
  stopFileCleanup
};
