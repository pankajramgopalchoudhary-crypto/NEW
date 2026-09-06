const TOKEN_KEY = 'ssu_token';
const REFRESH_KEY = 'ssu_refresh_token';

const isBrowser = typeof document !== 'undefined';

function getCookie(name) {
  if (!isBrowser) return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift() || null;
  return null;
}

function setCookie(name, value, days = 1) {
  if (!isBrowser) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === 'https:';
  const cookie = `${name}=${encodeURIComponent(value || '')}; Path=/; Expires=${expires}; SameSite=Strict; ${secure ? 'Secure; ' : ''}`;
  document.cookie = cookie;
}

function removeCookie(name) {
  if (!isBrowser) return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure; ' : ''}`;
}

export function getToken() {
  return getCookie(TOKEN_KEY);
}

export function getRefreshToken() {
  return getCookie(REFRESH_KEY);
}

export function setToken(token, refreshToken = '') {
  if (!token) return;
  setCookie(TOKEN_KEY, token, 1);
  if (refreshToken) setCookie(REFRESH_KEY, refreshToken, 7);
}

export function clearToken() {
  removeCookie(TOKEN_KEY);
  removeCookie(REFRESH_KEY);
}
