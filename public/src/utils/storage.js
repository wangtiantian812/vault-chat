export function getToken() {
  return localStorage.getItem('gh-token');
}

export function setToken(token) {
  localStorage.setItem('gh-token', token);
}

export function isLoggedIn() {
  return !!localStorage.getItem('auth-token');
}

export function logout() {
  localStorage.removeItem('auth-token');
}

export function isSetupDone() {
  return !!localStorage.getItem('app-password-hash');
}

export async function setAppPassword(password) {
  const hash = await sha256(password);
  localStorage.setItem('app-password-hash', hash);
  localStorage.setItem('auth-token', 'verified');
}

export async function verifyPassword(password) {
  const hash = await sha256(password);
  const stored = localStorage.getItem('app-password-hash');
  return hash === stored;
}

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getSettings() {
  const raw = localStorage.getItem('vault-chat-settings');
  if (!raw) return { apiKey: '' };
  try { return JSON.parse(raw); } catch (e) { return { apiKey: ''; } }
}

export function saveSettings(settings) {
  localStorage.setItem('vault-chat-settings', JSON.stringify(settings));
}
