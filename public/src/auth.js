import { isLoggedIn, isSetupDone, setToken, getSettings, saveSettings } from './utils/storage.js';
import { renderLogin } from './components/login-screen.js';
import { renderApp } from './components/app-shell.js';

const app = document.getElementById('app');

// Auto-configure from URL parameters (one-time setup link)
const params = new URLSearchParams(window.location.search);
let shouldCleanUrl = false;
const urlToken = params.get('token');
if (urlToken) {
  setToken(urlToken);
  params.delete('token');
  shouldCleanUrl = true;
}
const urlKey = params.get('key');
if (urlKey) {
  const settings = getSettings();
  saveSettings(Object.assign({}, settings, { apiKey: urlKey }));
  params.delete('key');
  shouldCleanUrl = true;
}
if (shouldCleanUrl) {
  const cleanUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);
}

export function init() {
  if (isSetupDone() && isLoggedIn()) {
    renderApp(app);
  } else {
    renderLogin(app);
  }
}

export function onLoginSuccess() {
  renderApp(app);
}

export function onLogout() {
  localStorage.removeItem('auth-token');
  renderLogin(app);
}

init();
