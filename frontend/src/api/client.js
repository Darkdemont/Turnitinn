export const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const roles = new Set(['customer', 'staff', 'admin']);

export function getPortalRoleFromPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/staff')) return 'staff';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'customer';
}

function roleKey(role, type) {
  const normalizedRole = roles.has(role) ? role : 'customer';
  return `turnit_${normalizedRole}_${type}`;
}

export function getToken(role = getPortalRoleFromPath()) {
  const token = localStorage.getItem(roleKey(role, 'token'));
  if (!token && role === 'customer') {
    return localStorage.getItem('turnit_token');
  }
  return token;
}

export function setStoredAuth(token, user) {
  localStorage.setItem(roleKey(user.role, 'token'), token);
  localStorage.setItem(roleKey(user.role, 'user'), JSON.stringify(user));
  localStorage.removeItem('turnit_token');
  localStorage.removeItem('turnit_user');
}

export function clearStoredAuth(role = getPortalRoleFromPath()) {
  localStorage.removeItem(roleKey(role, 'token'));
  localStorage.removeItem(roleKey(role, 'user'));
  if (role === 'customer') {
    localStorage.removeItem('turnit_token');
    localStorage.removeItem('turnit_user');
  }
}

export function getStoredUser(role = getPortalRoleFromPath()) {
  const raw = localStorage.getItem(roleKey(role, 'user')) ||
    (role === 'customer' ? localStorage.getItem('turnit_user') : null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken(options.authRole);
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'authRole')),
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const fieldError = Array.isArray(data?.errors) ? data.errors[0]?.message : null;
    throw new Error(fieldError || data?.message || 'Request failed.');
  }

  return data;
}

export async function downloadProtectedFile(endpoint, fallbackName) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'Download failed.');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackName || 'download';
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
