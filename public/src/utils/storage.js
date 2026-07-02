export function getToken() {
  return localStorage.getItem('auth-token');
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('auth-token');
}

export function getSettings() {
  const raw = localStorage.getItem('vault-chat-settings');
  if (!raw) return { apiKey: '' };
  try { return JSON.parse(raw); } catch { return { apiKey: ''; } }
}

export function saveSettings(settings) {
  localStorage.setItem('vault-chat-settings', JSON.stringify(settings));
}
