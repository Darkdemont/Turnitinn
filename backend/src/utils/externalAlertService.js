const twilio = require('twilio');
const env = require('../config/env');

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

function normalizePhoneNumber(value) {
  if (!value) return null;

  let phone = String(value).trim().replace(/[^\d+]/g, '');
  if (!phone) return null;
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  if (!env.defaultPhoneCountryCode) {
    return null;
  }
  if (phone.startsWith('0')) {
    return `${env.defaultPhoneCountryCode}${phone.slice(1)}`;
  }
  return `${env.defaultPhoneCountryCode}${phone}`;
}

function absoluteLink(linkPath) {
  try {
    return new URL(linkPath || '/staff/available-orders', env.publicAppUrl).toString();
  } catch {
    return `${env.publicAppUrl}${linkPath || '/staff/available-orders'}`;
  }
}

function canSendWhatsapp() {
  return (
    env.staffAlertChannel.toLowerCase() === 'whatsapp' &&
    env.twilioAccountSid &&
    env.twilioAuthToken &&
    env.twilioWhatsappFrom
  );
}

async function sendStaffOrderWhatsappAlerts({ staff, title, message, linkPath }) {
  if (!canSendWhatsapp()) {
    return;
  }

  const recipients = staff
    .map((user) => normalizePhoneNumber(user.phone))
    .filter(Boolean)
    .map((phone) => `whatsapp:${phone}`);

  if (!recipients.length) {
    return;
  }

  const body = `${title}\n${message}\n${absoluteLink(linkPath)}`;
  const results = await Promise.allSettled(
    recipients.map((to) =>
      getTwilioClient().messages.create({
        from: env.twilioWhatsappFrom,
        to,
        body
      })
    )
  );

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) {
    console.warn(`Failed to send ${failed.length} staff WhatsApp alert(s).`);
  }
}

module.exports = {
  sendStaffOrderWhatsappAlerts
};
