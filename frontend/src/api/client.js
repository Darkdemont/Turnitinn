export const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const roles = new Set(['customer', 'staff', 'admin', 'wholesaler']);
const authCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function getPortalRoleFromPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/wholesaler')) return 'wholesaler';
  if (pathname.startsWith('/staff')) return 'staff';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'customer';
}

function roleKey(role, type) {
  const normalizedRole = roles.has(role) ? role : 'customer';
  return `turnit_${normalizedRole}_${type}`;
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Some mobile private/in-app browsers block localStorage. Cookie fallback still runs.
  }
}

function safeLocalRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore blocked storage.
  }
}

function cookieOptions(maxAgeSeconds) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function setCookie(key, value, maxAgeSeconds = authCookieMaxAgeSeconds) {
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; ${cookieOptions(maxAgeSeconds)}`;
}

function removeCookie(key) {
  document.cookie = `${encodeURIComponent(key)}=; ${cookieOptions(0)}`;
}

function getCookie(key) {
  const encodedKey = `${encodeURIComponent(key)}=`;
  const match = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(encodedKey));
  return match ? decodeURIComponent(match.slice(encodedKey.length)) : null;
}

function getStoredValue(role, type) {
  const key = roleKey(role, type);
  return safeLocalGet(key) || getCookie(key);
}

function setStoredValue(role, type, value) {
  const key = roleKey(role, type);
  safeLocalSet(key, value);
  setCookie(key, value);
}

function removeStoredValue(role, type) {
  const key = roleKey(role, type);
  safeLocalRemove(key);
  removeCookie(key);
}

export function getToken(role = getPortalRoleFromPath()) {
  const token = getStoredValue(role, 'token');
  if (!token && role === 'customer') {
    return safeLocalGet('turnit_token') || getCookie('turnit_token');
  }
  return token;
}

export function setStoredAuth(token, user) {
  setStoredValue(user.role, 'token', token);
  setStoredValue(user.role, 'user', JSON.stringify(user));
  safeLocalRemove('turnit_token');
  safeLocalRemove('turnit_user');
  removeCookie('turnit_token');
  removeCookie('turnit_user');
}

export function clearStoredAuth(role = getPortalRoleFromPath()) {
  removeStoredValue(role, 'token');
  removeStoredValue(role, 'user');
  if (role === 'customer') {
    safeLocalRemove('turnit_token');
    safeLocalRemove('turnit_user');
    removeCookie('turnit_token');
    removeCookie('turnit_user');
  }
}

export function getStoredUser(role = getPortalRoleFromPath()) {
  const raw = getStoredValue(role, 'user') ||
    (role === 'customer' ? safeLocalGet('turnit_user') || getCookie('turnit_user') : null);
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
