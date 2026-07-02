import { login } from '../api.js';
import { onLoginSuccess } from '../auth.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-screen">
      <div class="login-box">
        <h1>王者之剑</h1>
        <p>移动端知识库</p>
        <input type="password" id="login-password" placeholder="输入密码" autocomplete="current-password">
        <button id="login-btn">登录</button>
        <div id="login-error" class="login-error" style="display:none"></div>
      </div>
    </div>
  `;

  const btn = document.getElementById('login-btn');
  const input = document.getElementById('login-password');
  const error = document.getElementById('login-error');

  async function doLogin() {
    btn.disabled = true;
    btn.textContent = '登录中...';
    error.style.display = 'none';
    try {
      await login(input.value);
      onLoginSuccess();
    } catch (e) {
      error.textContent = e.message;
      error.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  }

  btn.addEventListener('click', doLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  input.focus();
}
