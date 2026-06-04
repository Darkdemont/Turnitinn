const statusTone = {
  paid: 'success',
  available: 'info',
  accepted: 'warning',
  checking: 'warning',
  report_uploaded: 'info',
  completed: 'success',
  active: 'success',
  inactive: 'danger',
  unpaid: 'warning',
  failed: 'danger',
  cancelled: 'danger',
  refunded: 'neutral',
  pending: 'warning',
  pending_payment: 'warning'
};

function label(value) {
  return String(value || '-').replaceAll('_', ' ');
}

export default function StatusBadge({ value }) {
  return <span className={`status-badge ${statusTone[value] || 'neutral'}`}>{label(value)}</span>;
}
