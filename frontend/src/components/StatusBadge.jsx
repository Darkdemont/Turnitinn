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

const clientStatusLabels = {
  accepted: 'Processing',
  checking: 'Processing',
  report_uploaded: 'Finalizing'
};

function label(value) {
  return String(value || '-').replaceAll('_', ' ');
}

export default function StatusBadge({ value, audience }) {
  const text = audience === 'client' ? clientStatusLabels[value] || label(value) : label(value);
  return <span className={`status-badge ${statusTone[value] || 'neutral'}`}>{text}</span>;
}
