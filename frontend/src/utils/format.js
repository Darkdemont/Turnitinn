export function formatLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatUsd(value) {
  return `USD ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function serviceLabel(value) {
  return value === 'ai_similarity' ? 'AI + Similarity' : 'Similarity Only';
}

export function roleHome(role) {
  if (role === 'wholesaler') return '/wholesaler/dashboard';
  if (role === 'staff') return '/staff/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/customer/dashboard';
}

export function accountTypeLabel(value) {
  return value === 'wholesaler' ? 'Wholesaler' : 'Customer';
}
