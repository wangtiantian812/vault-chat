import { getSettings, saveSettings } from '../utils/storage.js';
import { onLogout } from '../auth.js';

export function renderSettings(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="settings-panel">
      <h2>设置</h2>
      <div class="settings-group">
        <label>AI 密钥（可选）</label>
        <input type="password" id="settings-apikey" value="${settings.apiKey || ''}" placeholder="sk-ant-xxxxx">
        <div class="hint">填入 Claude API Key 后可使用 AI 对话功能。留空则使用服务器配置的密钥。</div>
      </div>
      <div class="settings-group">
        <button id="settings-save">保存设置</button>
      </div>
      <button class="logout-btn" id="logout-btn">退出登录</button>
    </div>
  `;

  document.getElementById('settings-save').addEventListener('click', () => {
    const apiKey = document.getElementById('settings-apikey').value.trim();
    saveSettings({ ...settings, apiKey });
    showToast('设置已保存');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    onLogout();
  });
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
