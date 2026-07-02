import { isLoggedIn, isSetupDone } from './utils/storage.js';
import { renderLogin } from './components/login-screen.js';
import { renderApp } from './components/app-shell.js';

const app = document.getElementById('app');

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
