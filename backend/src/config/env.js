const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(backendRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const defaultUploadDir =
  process.env.NODE_ENV === 'production'
    ? path.resolve(projectRoot, '..', 'uploads')
    : 'uploads';
const uploadDir = process.env.UPLOAD_DIR || defaultUploadDir;
const uploadRoot = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.resolve(backendRoot, uploadDir);

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/turnit_phase1',
  jwtSecret: process.env.JWT_SECRET || 'development_only_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '365d',
  uploadRoot,
  maxFileSizeMb: numberFromEnv('MAX_FILE_SIZE_MB', 20),
  maxFilesPerOrder: numberFromEnv('MAX_FILES_PER_ORDER', 20),
  staffMaxActiveOrders: numberFromEnv('STAFF_MAX_ACTIVE_ORDERS', 3),
  fileRetentionHours: numberFromEnv('FILE_RETENTION_HOURS', 48),
  fileCleanupIntervalMinutes: numberFromEnv('FILE_CLEANUP_INTERVAL_MINUTES', 60),
  staffAlertChannel: process.env.STAFF_ALERT_CHANNEL || '',
  defaultPhoneCountryCode: process.env.DEFAULT_PHONE_COUNTRY_CODE || '+94',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  payheremerchantId: process.env.PAYHERE_MERCHANT_ID || '',
  payhereMerchantSecret: process.env.PAYHERE_MERCHANT_SECRET || '',
  payhereSandbox: process.env.PAYHERE_SANDBOX !== 'false'
};
