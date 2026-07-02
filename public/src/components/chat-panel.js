import { streamChat, writeNote } from '../api.js';
import { appState } from './app-shell.js';

let messages = [];
let isStreaming = false;

export function renderChatPanel(container) {
  messages = [];
  container.innerHTML = `
    <div class="chat-panel">
      <div class="chat-header">
        <div id="context-badges"></div>
      </div>
      <div id="chat-messages" class="chat-messages">
        <div style="text-align:center;color:var(--text-dim);padding:40px 20px">
          <p style="font-size:16px;margin-bottom:8px">AI 对话</p>
          <p style="font-size:13px">在笔记页面点击"与AI对话"添加上下文<br>或直接输入问题</p>
        </div>
      </div>
      <div class="chat-input-area">
        <textarea id="chat-input" placeholder="输入消息..." rows="1"></textarea>
        <button id="chat-send">发送</button>
      </div>
    </div>
  `;

  renderContextBadges();

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  sendBtn.addEventListener('click', () => sendMessage(container));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(container);
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

function renderContextBadges() {
  const badges = document.getElementById('context-badges');
  if (!badges) return;
  badges.innerHTML = appState.noteContext
    .map(
      (n, i) => `
      <span class="context-badge">
        ${n.path.split('/').pop().replace(/\.md$/, '')}
        <span class="remove-ctx" data-idx="${i}">&times;</span>
      </span>
    `
    )
    .join('');

  badges.querySelectorAll('.remove-ctx').forEach((el) => {
    el.addEventListener('click', () => {
      appState.noteContext.splice(parseInt(el.dataset.idx), 1);
      renderContextBadges();
    });
  });
}

async function sendMessage(container) {
  if (isStreaming) return;

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  messages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';

  renderMessages();

  const msgArea = document.getElementById('chat-messages');
  const assistantDiv = document.createElement('div');
  assistantDiv.className = 'chat-msg assistant';
  assistantDiv.innerHTML = '<div class="bubble"><div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div> 思考中...</div>';
  msgArea.appendChild(assistantDiv);
  msgArea.scrollTop = msgArea.scrollHeight;

  isStreaming = true;
  let fullText = '';

  try {
    await streamChat(
      messages,
      appState.noteContext,
      null,
      (chunk) => {
        fullText += chunk;
        assistantDiv.querySelector('.bubble').innerHTML = formatChatText(fullText);
        msgArea.scrollTop = msgArea.scrollHeight;
      },
      () => {
        messages.push({ role: 'assistant', content: fullText });
        isStreaming = false;
        const saveBtn = document.createElement('button');
        saveBtn.className = 'chat-save-btn';
        saveBtn.textContent = '保存到笔记';
        saveBtn.addEventListener('click', () => saveChatToNote(fullText));
        assistantDiv.querySelector('.bubble').appendChild(saveBtn);
      }
    );
  } catch (e) {
    assistantDiv.querySelector('.bubble').innerHTML = `<span style="color:var(--danger)">${e.message}</span>`;
    isStreaming = false;
  }
}

function renderMessages() {
  const msgArea = document.getElementById('chat-messages');
  const assistantMsgs = Array.from(msgArea.querySelectorAll('.chat-msg.assistant'));
  const html = messages
    .filter((m) => m.role === 'user')
    .map(
      (m) => `
      <div class="chat-msg user">
        <div class="bubble">${escapeHtml(m.content)}</div>
      </div>
    `
    )
    .join('');
  msgArea.innerHTML = html;
  assistantMsgs.forEach((el) => msgArea.appendChild(el));
  msgArea.scrollTop = msgArea.scrollHeight;
}

async function saveChatToNote(assistantText) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/, '');
  const fileName = `AI对话-${dateStr}-${timeStr}.md`;
  const path = `04 输出成果/${fileName}`;

  const contextNames = appState.noteContext.map((n) => n.path).join(', ');
  const content = `---\ntags: [AI对话]\ndate: ${now.toISOString()}\ncontext: "${contextNames}"\n---\n\n# AI对话 ${dateStr}\n\n${
    messages.map((m) => (m.role === 'user' ? `**我**: ${m.content}\n\n` : `**AI**: ${m.content}\n\n`)).join('')
  }`;

  try {
    await writeNote(path, content);
    showToast('已保存到笔记');
  } catch (e) {
    showToast(`保存失败: ${e.message}`);
  }
}

function formatChatText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
