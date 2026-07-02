import { login } from './api.js';
import { isLoggedIn, logout, getSettings, saveSettings } from './utils/storage.js';
import { renderLogin } from './components/login-screen.js';
import { renderApp } from './components/app-shell.js';

const app = document.getElementById('app');

export function init() {
  if (isLoggedIn()) {
    renderApp(app);
  } else {
    renderLogin(app);
  }
}

export function onLoginSuccess() {
  renderApp(app);
}

export function onLogout() {
  logout();
  renderLogin(app);
}
