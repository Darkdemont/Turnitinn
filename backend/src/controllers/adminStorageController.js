const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { logActivity } = require('../utils/activityLogger');
const { clearStoredFiles, getFileStorageSummary } = require('../services/fileCleanup');

const cleanupSchema = z.object({
  mode: z.enum(['expired', 'older_than', 'all']).default('expired'),
  older_than_hours: z.coerce.number().int().positive().max(8760).optional()
});

const storageSummary = asyncHandler(async (req, res) => {
  res.json({ storage: await getFileStorageSummary() });
});

const cleanupStorage = asyncHandler(async (req, res) => {
  const payload = cleanupSchema.parse(req.body || {});
  if (payload.mode === 'older_than' && !payload.older_than_hours) {
    throw new HttpError(400, 'older_than_hours is required for this cleanup.');
  }

  const result = await clearStoredFiles({
    mode: payload.mode,
    olderThanHours: payload.older_than_hours,
    reason: `admin_${payload.mode}`
  });

  await logActivity({
    userId: req.user.id,
    action: 'storage_cleanup',
    description: `${req.user.email} cleared ${result.total_files} physical file(s), keeping database history.`,
    ipAddress: req.ip
  });

  res.json({
    result,
    storage: await getFileStorageSummary()
  });
});

module.exports = {
  cleanupStorage,
  storageSummary
};
