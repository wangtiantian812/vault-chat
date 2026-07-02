import { isSetupDone, setAppPassword, verifyPassword } from '../utils/storage.js';
import { onLoginSuccess } from '../auth.js';

export function renderLogin(container) {
  const isReturning = isSetupDone();

  container.innerHTML = `
    <div class="login-screen">
      <div class="login-box">
        <h1>王者之剑</h1>
        <p>移动端知识库</p>
        <input type="password" id="login-password" placeholder="${isReturning ? '输入密码' : '设置密码'}" autocomplete="current-password">
        <input type="password" id="login-password2" placeholder="确认密码" style="${isReturning ? 'display:none' : ''}">
        <button id="login-btn">${isReturning ? '登录' : '设置密码并进入'}</button>
        <div id="login-error" class="login-error" style="display:none"></div>
      </div>
    </div>
  `;

  const btn = document.getElementById('login-btn');
  const input = document.getElementById('login-password');
  const input2 = document.getElementById('login-password2');
  const error = document.getElementById('login-error');

  async function doLogin() {
    const password = input.value;
    if (!password) {
      error.textContent = '请输入密码';
      error.style.display = 'block';
      return;
    }

    if (!isReturning) {
      const password2 = input2.value;
      if (password !== password2) {
        error.textContent = '两次密码不一致';
        error.style.display = 'block';
        return;
      }
      if (password.length < 4) {
        error.textContent = '密码至少4位';
        error.style.display = 'block';
        return;
      }
      btn.disabled = true;
      btn.textContent = '设置中...';
      await setAppPassword(password);
      onLoginSuccess();
    } else {
      btn.disabled = true;
      btn.textContent = '登录中...';
      const ok = await verifyPassword(password);
      if (ok) {
        onLoginSuccess();
      } else {
        error.textContent = '密码错误';
        error.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '登录';
      }
    }
  }

  btn.addEventListener('click', doLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (!isReturning && input2.style.display !== 'none') {
        input2.focus();
      } else {
        doLogin();
      }
    }
  });
  input2.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  input.focus();
}
