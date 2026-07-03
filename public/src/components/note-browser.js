import { fetchTree, fetchNote, searchNotes, writeNote } from '../api.js';
import { renderMarkdown, stripFrontmatter } from '../utils/markdown.js';
import { appState } from './app-shell.js';

let treeCache = null;
let currentView = 'list'; // 'list' | 'view' | 'edit'
let currentNote = null;

export function renderNoteBrowser(container) {
  container.innerHTML = `
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="搜索笔记...">
      <button id="search-btn">搜索</button>
    </div>
    <div id="folder-list" class="folder-list">
      <div class="loading"><div class="spinner"></div>加载中...</div>
    </div>
  `;

  loadTree(container);

  document.getElementById('search-btn').addEventListener('click', () => doSearch(container));
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch(container);
  });
}

async function loadTree(container) {
  const list = document.getElementById('folder-list');
  try {
    const data = await fetchTree();
    treeCache = data.tree;
    appState.tree = treeCache;
    list.innerHTML = '';
    renderTree(treeCache, list, container, 0, '');
  } catch (e) {
    if (e.message.includes('401')) {
      list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-dim)">
        <p style="font-size:16px;color:var(--danger);margin-bottom:12px">GitHub Token 无效或未配置</p>
        <p style="margin-bottom:20px">请前往「设置」页面重新配置</p>
        <button id="go-settings-from-error" style="padding:12px 24px;border:none;border-radius:var(--radius);background:var(--accent);color:white;font-size:15px;cursor:pointer">前往设置</button>
      </div>`;
      document.getElementById('go-settings-from-error').addEventListener('click', () => {
        document.querySelector('[data-tab="settings"]').click();
      });
    } else {
      list.innerHTML = `<p style="color:var(--danger)">加载失败: ${e.message}</p>`;
    }
  }
}

function renderTree(tree, parent, container, depth, prefix) {
  // Sort: folders first, then files
  const entries = Object.entries(tree).sort(([, a], [, b]) => {
    const aIsFolder = a !== null;
    const bIsFolder = b !== null;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return 0;
  });

  for (const [name, value] of entries) {
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (value === null) {
      // File
      const el = document.createElement('div');
      el.className = 'file-item';
      el.textContent = name.replace(/\.md$/, '');
      el.dataset.path = fullPath;
      el.addEventListener('click', () => openNote(fullPath, container));
      parent.appendChild(el);
    } else {
      // Folder
      const folder = document.createElement('div');
      folder.className = 'folder-item';

      const header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = `<span class="arrow">&#9654;</span> ${name}`;
      folder.appendChild(header);

      const children = document.createElement('div');
      children.className = 'folder-children';
      folder.appendChild(children);

      header.addEventListener('click', () => {
        const isOpen = children.classList.toggle('open');
        header.querySelector('.arrow').classList.toggle('open', isOpen);
        if (isOpen && children.children.length === 0) {
          renderTree(value, children, container, depth + 1, fullPath);
        }
      });

      parent.appendChild(folder);
    }
  }
}

async function openNote(path, container) {
  try {
    const data = await fetchNote(path);
    currentNote = data;
    currentView = 'view';
    renderNoteView(container, data);
  } catch (e) {
    showToast(`打开失败: ${e.message}`);
  }
}

function renderNoteView(container, note) {
  const { frontmatter, body } = stripFrontmatter(note.content);
  const html = renderMarkdown(body);

  container.innerHTML = `
    <div class="note-viewer">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <button id="back-btn" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:18px">&#8592;</button>
        <h1 style="flex:1;font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${note.path.split('/').pop().replace(/\.md$/, '')}
        </h1>
      </div>
      ${frontmatter ? `<div class="frontmatter">${frontmatter.replace(/\n/g, '<br>')}</div>` : ''}
      <div class="md-content">${html}</div>
      <div class="note-toolbar">
        <button id="edit-btn">编辑</button>
        <button id="chat-btn" class="primary">与AI对话</button>
      </div>
    </div>
  `;

  // Wiki-link clicks
  container.querySelectorAll('.wiki-link').forEach((el) => {
    el.addEventListener('click', async () => {
      const link = el.dataset.link;
      // Search for this note in the tree
      const found = findNotePath(treeCache, link);
      if (found) {
        try {
          const data = await fetchNote(found);
          currentNote = data;
          renderNoteView(container, data);
        } catch (e) {}
      } else {
        showToast(`未找到笔记: ${link}`);
      }
    });
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    currentView = 'list';
    renderNoteBrowser(container);
  });

  document.getElementById('edit-btn').addEventListener('click', () => {
    currentView = 'edit';
    renderNoteEditor(container, note);
  });

  document.getElementById('chat-btn').addEventListener('click', () => {
    appState.noteContext = [{ path: note.path, content: note.content }];
    // Switch to chat tab
    document.querySelector('[data-tab="chat"]').click();
  });
}

function renderNoteEditor(container, note) {
  container.innerHTML = `
    <div class="note-editor" style="display:flex;flex-direction:column;height:100%">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <button id="editor-back" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:18px">&#8592;</button>
        <span style="font-size:15px;font-weight:500">${note.path.split('/').pop()}</span>
      </div>
      <textarea id="editor-content">${note.content}</textarea>
      <div class="editor-actions">
        <button class="btn-cancel" id="editor-cancel">取消</button>
        <button class="btn-save" id="editor-save">保存</button>
      </div>
    </div>
  `;

  document.getElementById('editor-back').addEventListener('click', () => {
    currentView = 'view';
    renderNoteView(container, note);
  });
  document.getElementById('editor-cancel').addEventListener('click', () => {
    currentView = 'view';
    renderNoteView(container, note);
  });
  document.getElementById('editor-save').addEventListener('click', async () => {
    const content = document.getElementById('editor-content').value;
    try {
      const result = await writeNote(note.path, content, note.sha);
      showToast('保存成功');
      currentNote = { ...note, content, sha: result.sha };
      currentView = 'view';
      renderNoteView(container, currentNote);
    } catch (e) {
      showToast(`保存失败: ${e.message}`);
    }
  });
}

async function doSearch(container) {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;

  const list = document.getElementById('folder-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div>搜索中...</div>';

  try {
    const data = await searchNotes(q);
    list.innerHTML = '';
    if (data.results.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim);padding:20px">未找到结果</p>';
      return;
    }
    for (const item of data.results) {
      const el = document.createElement('div');
      el.className = 'file-item';
      const displayName = item.path.replace(/\.md$/, '');
      const folderPath = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
      el.innerHTML = `<div style="font-weight:500">${escapeHtml(displayName.split('/').pop())}</div>${
        folderPath ? `<div style="font-size:12px;color:var(--text-dim);margin-top:2px">${escapeHtml(folderPath)}</div>` : ''
      }`;
      el.addEventListener('click', async () => {
        try {
          const noteData = await fetchNote(item.path);
          currentNote = noteData;
          renderNoteView(container, noteData);
        } catch (e) {
          showToast(`打开失败: ${e.message}`);
        }
      });
      list.appendChild(el);
    }
  } catch (e) {
    list.innerHTML = `<p style="color:var(--danger)">搜索失败: ${e.message}</p>`;
  }
}

function findNotePath(tree, name, prefix = '') {
  for (const [key, value] of Object.entries(tree)) {
    const fullPath = prefix ? `${prefix}/${key}` : key;
    if (value === null && (key === name || key === `${name}.md`)) {
      return fullPath;
    }
    if (value !== null) {
      const found = findNotePath(value, name, fullPath);
      if (found) return found;
    }
  }
  return null;
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
