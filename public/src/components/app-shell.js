import { renderNoteBrowser } from './note-browser.js';
import { renderChatPanel } from './chat-panel.js';
import { renderSettings } from './settings.js';
import { getToken } from '../utils/storage.js';

let currentTab = 'notes';

export function renderApp(container) {
  const hasToken = !!getToken();

  container.innerHTML = `
    <div class="main-layout">
      <div class="main-content">
        <div id="tab-notes" class="tab-panel active"></div>
        <div id="tab-chat" class="tab-panel"></div>
        <div id="tab-settings" class="tab-panel"></div>
      </div>
      <nav class="tab-bar">
        <button class="active" data-tab="notes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          <span>笔记</span>
        </button>
        <button data-tab="chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <span>对话</span>
        </button>
        <button data-tab="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          <span>设置</span>
        </button>
      </nav>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.tab-bar button');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === currentTab) return;
      currentTab = target;

      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(`tab-${target}`).classList.add('active');

      if (target === 'notes' && !document.getElementById('tab-notes').dataset.init) {
        renderNoteBrowser(document.getElementById('tab-notes'));
        document.getElementById('tab-notes').dataset.init = '1';
      } else if (target === 'chat' && !document.getElementById('tab-chat').dataset.init) {
        renderChatPanel(document.getElementById('tab-chat'));
        document.getElementById('tab-chat').dataset.init = '1';
      } else if (target === 'settings' && !document.getElementById('tab-settings').dataset.init) {
        renderSettings(document.getElementById('tab-settings'));
        document.getElementById('tab-settings').dataset.init = '1';
      }
    });
  });

  if (hasToken) {
    renderNoteBrowser(document.getElementById('tab-notes'));
  } else {
    // No token configured yet — show setup prompt
    document.getElementById('tab-notes').innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-dim)">
        <p style="font-size:18px;margin-bottom:12px;color:var(--text)">欢迎使用王者之剑</p>
        <p style="margin-bottom:20px">请先在「设置」中配置 GitHub Token</p>
        <button id="go-settings" style="padding:12px 24px;border:none;border-radius:var(--radius);background:var(--accent);color:white;font-size:15px;cursor:pointer">前往设置</button>
      </div>
    `;
    document.getElementById('go-settings').addEventListener('click', () => {
      document.querySelector('[data-tab="settings"]').click();
    });
  }
  document.getElementById('tab-notes').dataset.init = '1';
}

export const appState = {
  noteContext: [],
  tree: null,
};
