import { getSettings, saveSettings, getToken, setToken } from '../utils/storage.js';
import { onLogout } from '../auth.js';

export function renderSettings(container) {
  const settings = getSettings();
  const currentToken = getToken() || '';

  container.innerHTML = `
    <div class="settings-panel">
      <h2>设置</h2>
      <div class="settings-group">
        <label>GitHub Token</label>
        <input type="password" id="settings-token" value="${currentToken}" placeholder="ghp_xxxxx 或 github_pat_xxxxx">
        <div class="hint">用于读取和编辑笔记。没有 Token？<a href="https://github.com/settings/tokens?type=beta" target="_blank" style="color:var(--accent)">点击生成</a>（Fine-grained，选 obsidian-vault 仓库，权限 Contents: Read and write）</div>
      </div>
      <div class="settings-group">
        <label>Claude API Key（可选）</label>
        <input type="password" id="settings-apikey" value="${settings.apiKey || ''}" placeholder="sk-ant-xxxxx">
        <div class="hint">用于 AI 对话功能。留空则无法使用对话。</div>
      </div>
      <div class="settings-group">
        <button id="settings-save">保存设置</button>
      </div>
      <button class="logout-btn" id="logout-btn">退出登录</button>
      <div class="settings-group" style="margin-top:20px">
        <label>快捷配置</label>
        <div class="hint">如果 Token 无效，请在浏览器地址栏重新打开配置链接（含 token 和 key 参数），系统会自动保存。</div>
      </div>
    </div>
  `;

  document.getElementById('settings-save').addEventListener('click', () => {
    const token = document.getElementById('settings-token').value.trim();
    const apiKey = document.getElementById('settings-apikey').value.trim();
    if (token) setToken(token);
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
