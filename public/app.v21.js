// Vault Chat - Single Bundle
// All code in one file, no ES modules, max compatibility

var VaultChat = {
  VERSION: 'v21',
  state: { noteContext: [], tree: null, currentTab: 'notes', imageMap: {}, chatHistoryId: null }
};

// ============ STORAGE ============

VaultChat.getToken = function() {
  return localStorage.getItem('gh-token');
};

VaultChat.setToken = function(token) {
  localStorage.setItem('gh-token', token);
};

VaultChat.isLoggedIn = function() {
  // If password was set before, always consider logged in
  if (localStorage.getItem('app-password-hash')) {
    if (!localStorage.getItem('auth-token')) {
      localStorage.setItem('auth-token', 'verified');
    }
    return true;
  }
  return false;
};

VaultChat.isSetupDone = function() {
  return !!localStorage.getItem('app-password-hash');
};

VaultChat.setAppPassword = function(password) {
  return VaultChat.sha256(password).then(function(hash) {
    localStorage.setItem('app-password-hash', hash);
    localStorage.setItem('auth-token', 'verified');
  });
};

VaultChat.verifyPassword = function(password) {
  return VaultChat.sha256(password).then(function(hash) {
    return hash === localStorage.getItem('app-password-hash');
  });
};

VaultChat.sha256 = function(text) {
  var encoder = new TextEncoder();
  var data = encoder.encode(text);
  return crypto.subtle.digest('SHA-256', data).then(function(hashBuffer) {
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
};

VaultChat.getSettings = function() {
  var raw = localStorage.getItem('vault-chat-settings');
  if (!raw) return { apiKey: '' };
  try { return JSON.parse(raw); } catch (e) { return { apiKey: '' }; }
};

VaultChat.saveSettings = function(settings) {
  localStorage.setItem('vault-chat-settings', JSON.stringify(settings));
};

// ============ CHAT HISTORY ============

VaultChat.HISTORY_KEY = 'vault-chat-history';
VaultChat.MAX_HISTORY = 50;

VaultChat.getChatHistories = function() {
  var raw = localStorage.getItem(VaultChat.HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
};

VaultChat.saveChatHistories = function(list) {
  localStorage.setItem(VaultChat.HISTORY_KEY, JSON.stringify(list));
};

VaultChat.saveCurrentChat = function() {
  var V = VaultChat;
  if (V.chatMessages.length === 0) return;
  var list = V.getChatHistories();
  var now = new Date();
  var firstUserMsg = '';
  for (var i = 0; i < V.chatMessages.length; i++) {
    if (V.chatMessages[i].role === 'user') {
      firstUserMsg = V.chatMessages[i].content;
      break;
    }
  }
  var summary = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg;
  var contextPaths = V.state.noteContext.map(function(n) { return n.path; });

  if (V.state.chatHistoryId) {
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === V.state.chatHistoryId) {
        list[j].messages = V.chatMessages.slice();
        list[j].updatedAt = now.toISOString();
        list[j].contextPaths = contextPaths;
        list[j].msgCount = V.chatMessages.length;
        V.saveChatHistories(list);
        return;
      }
    }
  }

  var entry = {
    id: 'chat_' + now.getTime(),
    summary: summary,
    messages: V.chatMessages.slice(),
    contextPaths: contextPaths,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    msgCount: V.chatMessages.length
  };
  list.unshift(entry);
  if (list.length > V.MAX_HISTORY) list = list.slice(0, V.MAX_HISTORY);
  V.saveChatHistories(list);
  V.state.chatHistoryId = entry.id;
};

VaultChat.loadChatHistory = function(id) {
  var list = VaultChat.getChatHistories();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
};

VaultChat.deleteChatHistory = function(id) {
  var list = VaultChat.getChatHistories();
  list = list.filter(function(h) { return h.id !== id; });
  VaultChat.saveChatHistories(list);
};

VaultChat.formatTimeAgo = function(isoStr) {
  var now = new Date();
  var then = new Date(isoStr);
  var diffMs = now - then;
  var diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return diffMin + '分钟前';
  var diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + '小时前';
  var diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return diffDay + '天前';
  return then.getMonth() + 1 + '/' + then.getDate();
};

// ============ MARKDOWN ============

VaultChat.renderMarkdown = function(md) {
  var html = md;
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    return '<pre><code class="lang-' + lang + '">' + code.trim() + '</code></pre>';
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/!\[\[([^\]]+)\]\]/g, function(_, name) {
    var imgPath = VaultChat.state.imageMap && (VaultChat.state.imageMap[name] || VaultChat.state.imageMap[name.toLowerCase()]);
    if (imgPath) {
      var rawUrl = 'https://raw.githubusercontent.com/' + VaultChat.OWNER + '/' + VaultChat.REPO + '/' + VaultChat.BRANCH + '/' + imgPath.split('/').map(encodeURIComponent).join('/');
      return '<img src="' + rawUrl + '" alt="' + name + '" style="max-width:100%;border-radius:8px;margin:8px 0" loading="lazy">';
    }
    return '<span style="color:var(--text-dim)">[图片: ' + name + ']</span>';
  });
  html = html.replace(/\[\[([^\]]+)\]\]/g, function(_, link) {
    return '<span class="wiki-link" data-link="' + link + '">' + link + '</span>';
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^(?!<[hupol]|<li|<hr|<pre|<code|<img|<ul|<div)(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
};

VaultChat.stripFrontmatter = function(content) {
  if (!content.startsWith('---')) return { frontmatter: null, body: content };
  var end = content.indexOf('---', 3);
  if (end === -1) return { frontmatter: null, body: content };
  var fm = content.slice(3, end).trim();
  var body = content.slice(end + 3).trim();
  return { frontmatter: fm, body: body };
};

// ============ API ============

VaultChat.GH_API = 'https://api.github.com';
VaultChat.CLAUDE_API = 'https://api.anthropic.com/v1/messages';
VaultChat.CORS_PROXY = 'https://corsproxy.io/?url=';
VaultChat.OWNER = 'wangtiantian812';
VaultChat.REPO = 'obsidian-vault';
VaultChat.BRANCH = 'main';

VaultChat.ghHeaders = function() {
  var token = localStorage.getItem('gh-token');
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github.v3+json'
  };
};

VaultChat.fetchTree = function() {
  var self = VaultChat;
  return fetch(
    self.GH_API + '/repos/' + self.OWNER + '/' + self.REPO + '/git/trees/' + self.BRANCH + '?recursive=1',
    { headers: self.ghHeaders() }
  ).then(function(res) {
    if (!res.ok) throw new Error('获取文件树失败: ' + res.status);
    return res.json();
  }).then(function(data) {
    var imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
    var mdFiles = [];
    var imageMap = {};
    for (var ti = 0; ti < data.tree.length; ti++) {
      var item = data.tree[ti];
      if (item.type !== 'blob') continue;
      if (item.path.endsWith('.md')) {
        mdFiles.push(item);
      } else {
        var lower = item.path.toLowerCase();
        for (var ei = 0; ei < imgExts.length; ei++) {
          if (lower.endsWith(imgExts[ei])) {
            var fileName = item.path.split('/').pop();
            imageMap[fileName] = item.path;
            break;
          }
        }
      }
    }
    self.state.imageMap = imageMap;
    var tree = {};
    for (var fi = 0; fi < mdFiles.length; fi++) {
      var filePath = mdFiles[fi].path;
      var parts = filePath.split('/');
      var current = tree;
      for (var i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = null;
    }
    return { tree: tree };
  });
};

VaultChat.fetchNote = function(path) {
  var self = VaultChat;
  var encoded = encodeURIComponent(path);
  return fetch(
    self.GH_API + '/repos/' + self.OWNER + '/' + self.REPO + '/contents/' + encoded + '?ref=' + self.BRANCH,
    { headers: self.ghHeaders() }
  ).then(function(res) {
    if (!res.ok) throw new Error('获取笔记失败: ' + res.status);
    return res.json();
  }).then(function(data) {
    var content = atob(data.content.replace(/\n/g, ''));
    var decoded = decodeURIComponent(escape(content));
    return { path: path, content: decoded, sha: data.sha };
  });
};

VaultChat.searchNotes = function(q) {
  var self = VaultChat;
  var query = q + ' repo:' + self.OWNER + '/' + self.REPO + ' path:*.md';
  return fetch(
    self.GH_API + '/search/code?q=' + encodeURIComponent(query) + '&per_page=20',
    { headers: self.ghHeaders() }
  ).then(function(res) {
    if (!res.ok) throw new Error('搜索失败: ' + res.status);
    return res.json();
  }).then(function(data) {
    var results = (data.items || []).map(function(item) {
      return { path: item.path, name: item.name };
    });
    return { results: results, total: results.length };
  });
};

VaultChat.writeNote = function(path, content, sha) {
  var self = VaultChat;
  var encoded = encodeURIComponent(path);
  var body = {
    message: 'Vault Chat更新: ' + path.split('/').pop(),
    content: btoa(unescape(encodeURIComponent(content))),
    branch: self.BRANCH
  };
  if (sha) body.sha = sha;
  return fetch(
    self.GH_API + '/repos/' + self.OWNER + '/' + self.REPO + '/contents/' + encoded,
    {
      method: 'PUT',
      headers: Object.assign({}, self.ghHeaders(), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    }
  ).then(function(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(err) {
        throw new Error(err.message || '保存失败: ' + res.status);
      });
    }
    return res.json();
  }).then(function(data) {
    var contentSha = (data.content && data.content.sha) || (data.commit && data.commit.sha);
    return { ok: true, sha: contentSha };
  });
};

VaultChat.streamChat = function(messages, noteContext, apiKey, onChunk, onDone) {
  var self = VaultChat;
  var settings = self.getSettings();
  var key = apiKey || settings.apiKey;
  if (!key) throw new Error('未配置AI密钥，请在设置中填入 API Key');

  var noteCtxText = '（无笔记上下文）';
  if (noteContext && noteContext.length > 0) {
    noteCtxText = noteContext.map(function(n) {
      return '--- 文件: ' + n.path + ' ---\n' + n.content + '\n';
    }).join('\n');
  }

  var treeText = '（未加载）';
  if (self.state.tree) {
    var allPaths = [];
    self._collectPaths(self.state.tree, '', allPaths);
    treeText = allPaths.map(function(p) { return p.replace(/\.md$/, ''); }).join('\n');
  }

  var systemPrompt = '你是"王者之剑"知识库的AI助手。这是用户的个人知识库，包含工作、学习、个人成长等内容。\n\n' +
    '知识库目录结构：\n' + treeText + '\n\n' +
    '引用的笔记上下文：\n' + noteCtxText + '\n\n' +
    '请用中文回答。优先基于提供的笔记内容回答。如果笔记中有相关信息请引用，如果没有相关信息可以基于你的知识回答，但需要说明笔记中未找到相关内容。';

  var apiBase = (settings.apiBase || '').trim();
  var isGemini = apiBase.indexOf('generativelanguage.googleapis.com') !== -1 || (settings.provider === 'gemini');
  var isDeepSeek = settings.provider === 'deepseek';

  if (isDeepSeek) {
    return self.streamDeepSeek(key, systemPrompt, messages, onChunk, onDone);
  }
  if (isGemini) {
    return self.streamGemini(key, systemPrompt, messages, onChunk, onDone);
  }

  var useCorsProxy = !apiBase;
  var fetchUrl = useCorsProxy ? (self.CORS_PROXY + encodeURIComponent(self.CLAUDE_API)) : apiBase;

  var headers = {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01'
  };
  if (settings.customHeaders) {
    try {
      var custom = JSON.parse(settings.customHeaders);
      var ckeys = Object.keys(custom);
      for (var i = 0; i < ckeys.length; i++) {
        headers[ckeys[i]] = custom[ckeys[i]];
      }
    } catch (e) {}
  }

  return fetch(fetchUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: settings.model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages || [],
      stream: true
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(text) {
        var errMsg = '聊天请求失败 (' + res.status + ')';
        try {
          var data = JSON.parse(text);
          errMsg = (data.error && data.error.message) || data.error || errMsg;
        } catch (e) {
          if (text) errMsg = text.substring(0, 200);
        }
        throw new Error(errMsg);
      });
    }
    return res;
  }).then(function(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();

    function readChunk() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        var chunk = decoder.decode(result.value, { stream: true });
        var lines = chunk.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (line.startsWith('data: ')) {
            var data = line.slice(6);
            if (data === '[DONE]') {
              if (onDone) onDone();
              return;
            }
            try {
              var parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
                onChunk(parsed.delta.text);
              } else if (parsed.type === 'message_stop') {
                if (onDone) onDone();
                return;
              }
            } catch (e) {}
          }
        }
        return readChunk();
      });
    }
    return readChunk();
  });
};

// Google Gemini streaming
VaultChat.streamGemini = function(apiKey, systemPrompt, messages, onChunk, onDone) {
  var geminiMessages = [];
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    geminiMessages.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    });
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=' + apiKey;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMessages,
      generationConfig: { maxOutputTokens: 2048 }
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(text) {
        var errMsg = 'Gemini 请求失败 (' + res.status + ')';
        try {
          var data = JSON.parse(text);
          errMsg = (data.error && data.error.message) || errMsg;
        } catch (e) {
          if (text) errMsg = text.substring(0, 200);
        }
        throw new Error(errMsg);
      });
    }
    return res;
  }).then(function(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();

    function readChunk() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        var chunk = decoder.decode(result.value, { stream: true });
        var lines = chunk.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (line.startsWith('data: ')) {
            var data = line.slice(6).trim();
            if (!data) continue;
            try {
              var parsed = JSON.parse(data);
              if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content &&
                  parsed.candidates[0].content.parts && parsed.candidates[0].content.parts[0]) {
                var text = parsed.candidates[0].content.parts[0].text;
                if (text) onChunk(text);
              }
            } catch (e) {}
          }
        }
        return readChunk();
      });
    }
    return readChunk();
  });
};

// DeepSeek streaming
VaultChat.streamDeepSeek = function(apiKey, systemPrompt, messages, onChunk, onDone) {
  var dsMessages = [{ role: 'system', content: systemPrompt }];
  for (var i = 0; i < messages.length; i++) {
    dsMessages.push({ role: messages[i].role, content: messages[i].content });
  }

  return fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: dsMessages,
      max_tokens: 2048,
      stream: true
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(text) {
        var errMsg = 'DeepSeek 请求失败 (' + res.status + ')';
        try {
          var data = JSON.parse(text);
          errMsg = (data.error && data.error.message) || errMsg;
        } catch (e) {
          if (text) errMsg = text.substring(0, 200);
        }
        throw new Error(errMsg);
      });
    }
    return res;
  }).then(function(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();

    function readChunk() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        var chunk = decoder.decode(result.value, { stream: true });
        var lines = chunk.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (line.startsWith('data: ')) {
            var data = line.slice(6).trim();
            if (data === '[DONE]') {
              if (onDone) onDone();
              return;
            }
            try {
              var parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                onChunk(parsed.choices[0].delta.content);
              }
            } catch (e) {}
          }
        }
        return readChunk();
      });
    }
    return readChunk();
  });
};

// ============ COMPONENTS ============

// --- Toast ---
VaultChat.showToast = function(msg) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
};

// --- Fullscreen ---
VaultChat.tryFullscreen = function() {
  var el = document.documentElement;
  var rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (rfs) {
    rfs.call(el).catch(function() {});
  }
};

VaultChat.isFullscreen = function() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
};

// Auto-enter fullscreen on first touch (browsers require user gesture)
VaultChat._fullscreenOnce = function() {
  if (VaultChat.isFullscreen()) return;
  VaultChat.tryFullscreen();
  document.removeEventListener('touchstart', VaultChat._fullscreenOnce);
  document.removeEventListener('click', VaultChat._fullscreenOnce);
};
document.addEventListener('touchstart', VaultChat._fullscreenOnce, { once: true });
document.addEventListener('click', VaultChat._fullscreenOnce, { once: true });

// --- Login Screen ---
VaultChat.renderLogin = function(container) {
  var V = VaultChat;
  var isReturning = V.isSetupDone();

  container.innerHTML =
    '<div class="login-screen">' +
      '<div class="login-box">' +
        '<h1>王者之剑</h1>' +
        '<p>移动端知识库</p>' +
        '<input type="password" id="login-password" placeholder="' + (isReturning ? '输入密码' : '设置密码') + '" autocomplete="current-password">' +
        '<input type="password" id="login-password2" placeholder="确认密码" style="' + (isReturning ? 'display:none' : '') + '">' +
        '<button id="login-btn">' + (isReturning ? '登录' : '设置密码并进入') + '</button>' +
        '<div id="login-error" class="login-error" style="display:none"></div>' +
      '</div>' +
    '</div>';

  var btn = document.getElementById('login-btn');
  var input = document.getElementById('login-password');
  var input2 = document.getElementById('login-password2');
  var error = document.getElementById('login-error');

  function doLogin() {
    var password = input.value;
    if (!password) {
      error.textContent = '请输入密码';
      error.style.display = 'block';
      return;
    }
    if (!isReturning) {
      var password2 = input2.value;
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
      V.setAppPassword(password).then(function() {
        V.tryFullscreen();
        V.renderApp(container);
      });
    } else {
      btn.disabled = true;
      btn.textContent = '登录中...';
      V.verifyPassword(password).then(function(ok) {
        if (ok) {
          V.tryFullscreen();
          V.renderApp(container);
        } else {
          error.textContent = '密码错误';
          error.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '登录';
        }
      });
    }
  }

  btn.addEventListener('click', doLogin);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (!isReturning && input2.style.display !== 'none') {
        input2.focus();
      } else {
        doLogin();
      }
    }
  });
  input2.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  input.focus();
};

// --- Settings ---
VaultChat.renderSettings = function(container) {
  var V = VaultChat;
  var settings = V.getSettings();
  var currentToken = V.getToken() || '';
  var currentProvider = settings.provider || 'deepseek';

  container.innerHTML =
    '<div class="settings-panel">' +
      '<h2>设置</h2>' +
      '<div class="settings-group">' +
        '<label>GitHub Token</label>' +
        '<input type="password" id="settings-token" value="' + currentToken + '" placeholder="ghp_xxxxx">' +
        '<div class="hint">用于读取和编辑笔记</div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<label>AI 对话引擎</label>' +
        '<select id="settings-provider" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--bg-input);color:var(--text);font-size:14px">' +
          '<option value="deepseek"' + (currentProvider === 'deepseek' ? ' selected' : '') + '>DeepSeek（免费推荐）</option>' +
          '<option value="gemini"' + (currentProvider === 'gemini' ? ' selected' : '') + '>Google Gemini（免费）</option>' +
          '<option value="claude"' + (currentProvider === 'claude' ? ' selected' : '') + '>Claude（需官方Key）</option>' +
        '</select>' +
      '</div>' +
      '<div id="deepseek-settings" style="display:' + (currentProvider === 'deepseek' ? 'block' : 'none') + '">' +
        '<div class="settings-group">' +
          '<label>DeepSeek API Key</label>' +
          '<input type="password" id="settings-ds-key" value="' + (settings.apiKey || '') + '" placeholder="sk-xxxxx">' +
          '<div class="hint">免费注册：<a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--accent)">platform.deepseek.com</a> → 手机号注册 → 创建 API Key</div>' +
        '</div>' +
      '</div>' +
      '<div id="gemini-settings" style="display:' + (currentProvider === 'gemini' ? 'block' : 'none') + '">' +
        '<div class="settings-group">' +
          '<label>Gemini API Key</label>' +
          '<input type="password" id="settings-gm-key" value="' + (settings.geminiKey || '') + '" placeholder="AIzaSyxxxxx">' +
          '<div class="hint">免费获取：<a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent)">Google AI Studio</a></div>' +
        '</div>' +
      '</div>' +
      '<div id="claude-settings" style="display:' + (currentProvider === 'claude' ? 'block' : 'none') + '">' +
        '<div class="settings-group">' +
          '<label>Claude API Key</label>' +
          '<input type="password" id="settings-claude-key" value="' + (settings.claudeKey || '') + '" placeholder="sk-ant-xxxxx">' +
          '<div class="hint">需 Anthropic 官方 Key</div>' +
        '</div>' +
        '<div class="settings-group">' +
          '<label>自定义代理地址（可选）</label>' +
          '<input type="text" id="settings-apibase" value="' + (settings.apiBase || '') + '" placeholder="留空用默认地址">' +
        '</div>' +
        '<div class="settings-group">' +
          '<label>自定义请求头（可选）</label>' +
          '<textarea id="settings-headers" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--bg-input);color:var(--text);font-size:13px;resize:vertical;font-family:monospace" placeholder=\'{"X-OB-Version":"1.12.7"}\'>' + (settings.customHeaders || '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<button id="settings-save">保存设置</button>' +
      '</div>' +
      '<div class="settings-group">' +
        '<button id="install-app-btn" style="width:100%;padding:12px;border:none;border-radius:12px;background:#22c55e;color:white;font-size:15px;cursor:pointer;font-weight:bold">安装到桌面（App模式）</button>' +
        '<div id="install-status" style="margin-top:8px;font-size:12px;color:var(--text-dim);text-align:center"></div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<button id="force-refresh-btn" style="width:100%;padding:12px;border:1px solid var(--accent);border-radius:12px;background:transparent;color:var(--accent);font-size:15px;cursor:pointer">清除缓存并刷新</button>' +
      '</div>' +
      '<div class="settings-group">' +
        '<button id="fullscreen-btn" style="width:100%;padding:12px;border:none;border-radius:12px;background:#7c5cff;color:white;font-size:15px;cursor:pointer;font-weight:bold">全屏模式</button>' +
        '<div id="fullscreen-status" style="margin-top:8px;font-size:12px;color:var(--text-dim);text-align:center"></div>' +
      '</div>' +
      '<button class="logout-btn" id="logout-btn">退出登录</button>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:12px;margin-top:20px">版本 ' + V.VERSION + '</div>' +
    '</div>';

  document.getElementById('settings-provider').addEventListener('change', function() {
    var provider = this.value;
    document.getElementById('deepseek-settings').style.display = provider === 'deepseek' ? 'block' : 'none';
    document.getElementById('gemini-settings').style.display = provider === 'gemini' ? 'block' : 'none';
    document.getElementById('claude-settings').style.display = provider === 'claude' ? 'block' : 'none';
  });

  document.getElementById('settings-save').addEventListener('click', function() {
    var token = document.getElementById('settings-token').value.trim();
    var provider = document.getElementById('settings-provider').value;
    var dsKey = document.getElementById('settings-ds-key') ? document.getElementById('settings-ds-key').value.trim() : '';
    var gmKey = document.getElementById('settings-gm-key') ? document.getElementById('settings-gm-key').value.trim() : '';
    var claudeKey = document.getElementById('settings-claude-key') ? document.getElementById('settings-claude-key').value.trim() : '';
    var apiBase = document.getElementById('settings-apibase') ? document.getElementById('settings-apibase').value.trim() : '';
    var customHeaders = document.getElementById('settings-headers') ? document.getElementById('settings-headers').value.trim() : '';

    if (token) V.setToken(token);

    var activeKey = provider === 'deepseek' ? dsKey : (provider === 'gemini' ? gmKey : claudeKey);
    var newSettings = Object.assign({}, settings, {
      provider: provider,
      apiKey: activeKey,
      deepseekKey: dsKey || '',
      geminiKey: gmKey || '',
      claudeKey: claudeKey || '',
      apiBase: apiBase || '',
      customHeaders: customHeaders || ''
    });
    V.saveSettings(newSettings);
    V.showToast('设置已保存');
    // Reset notes tab so it re-loads with new token
    var notesPanel = document.getElementById('tab-notes');
    if (notesPanel) {
      delete notesPanel.dataset.init;
      notesPanel.innerHTML = '';
      if (V.state.currentTab === 'notes') {
        V.renderNoteBrowser(notesPanel);
        notesPanel.dataset.init = '1';
      }
    }
  });

  var installBtn = document.getElementById('install-app-btn');
  var installStatus = document.getElementById('install-status');

  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    if (installBtn) installBtn.style.display = 'none';
    if (installStatus) installStatus.textContent = '已安装为App，从桌面打开即可';
  }

  if (installBtn && !isStandalone) {
    installBtn.addEventListener('click', function() {
      if (V.deferredInstallPrompt) {
        V.deferredInstallPrompt.prompt();
        V.deferredInstallPrompt.userChoice.then(function(choice) {
          if (choice.outcome === 'accepted') {
            V.showToast('安装成功！');
          }
          V.deferredInstallPrompt = null;
        });
        return;
      }
      V.showInstallGuide();
    });
  }

  document.getElementById('force-refresh-btn').addEventListener('click', function() {
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (var i = 0; i < names.length; i++) caches.delete(names[i]);
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) regs[i].unregister();
      });
    }
    window.location.reload(true);
  });

  var fsBtn = document.getElementById('fullscreen-btn');
  var fsStatus = document.getElementById('fullscreen-status');
  if (V.isFullscreen()) {
    if (fsStatus) fsStatus.textContent = '当前已是全屏模式';
  }
  if (fsBtn) {
    fsBtn.addEventListener('click', function() {
      V.tryFullscreen();
      setTimeout(function() {
        if (fsStatus) fsStatus.textContent = V.isFullscreen() ? '已进入全屏模式' : '全屏请求已发送，请允许';
      }, 500);
    });
  }

  document.getElementById('logout-btn').addEventListener('click', function() {
    localStorage.removeItem('auth-token');
    V.renderLogin(container);
  });
};

// --- Note Browser ---
VaultChat.renderNoteBrowser = function(container) {
  var V = VaultChat;

  container.innerHTML =
    '<div class="search-bar">' +
      '<input type="text" id="search-input" placeholder="搜索笔记...">' +
      '<button id="search-btn">搜索</button>' +
    '</div>' +
    '<div id="folder-list" class="folder-list">' +
      '<div class="loading"><div class="spinner"></div>加载中...</div>' +
    '</div>';

  V.loadTree(container);

  document.getElementById('search-btn').addEventListener('click', function() { V.doSearch(container); });
  document.getElementById('search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') V.doSearch(container);
  });
};

VaultChat.loadTree = function(container) {
  var V = VaultChat;
  var list = document.getElementById('folder-list');
  V.fetchTree().then(function(data) {
    V.state.tree = data.tree;
    list.innerHTML = '';
    V.renderTree(data.tree, list, container, 0, '');
  }).catch(function(e) {
    if (e.message.indexOf('401') !== -1) {
      list.innerHTML =
        '<div style="text-align:center;padding:40px 20px;color:var(--text-dim)">' +
          '<p style="font-size:16px;color:var(--danger);margin-bottom:12px">GitHub Token 无效或未配置</p>' +
          '<p style="margin-bottom:20px">请前往「设置」页面配置 Token</p>' +
          '<button id="go-settings-from-error" style="padding:12px 24px;border:none;border-radius:12px;background:var(--accent);color:white;font-size:15px;cursor:pointer">前往设置</button>' +
        '</div>';
      document.getElementById('go-settings-from-error').addEventListener('click', function() {
        document.querySelector('[data-tab="settings"]').click();
      });
    } else {
      list.innerHTML = '<p style="color:var(--danger)">加载失败: ' + e.message + '</p>';
    }
  });
};

VaultChat.renderTree = function(tree, parent, container, depth, prefix) {
  var V = VaultChat;
  var entries = Object.entries(tree).sort(function(a, b) {
    var aIsFolder = a[1] !== null;
    var bIsFolder = b[1] !== null;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return 0;
  });

  for (var ei = 0; ei < entries.length; ei++) {
    var name = entries[ei][0];
    var value = entries[ei][1];
    var fullPath = prefix ? prefix + '/' + name : name;

    if (value === null) {
      var el = document.createElement('div');
      el.className = 'file-item';
      el.textContent = name.replace(/\.md$/, '');
      el.dataset.path = fullPath;
      (function(p) {
        el.addEventListener('click', function() { V.openNote(p, container); });
      })(fullPath);
      parent.appendChild(el);
    } else {
      var folder = document.createElement('div');
      folder.className = 'folder-item';
      var header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = '<span class="arrow">&#9654;</span> ' + name;
      folder.appendChild(header);
      var children = document.createElement('div');
      children.className = 'folder-children';
      folder.appendChild(children);
      (function(val, ch, fp) {
        header.addEventListener('click', function() {
          var isOpen = ch.classList.toggle('open');
          header.querySelector('.arrow').classList.toggle('open', isOpen);
          if (isOpen && ch.children.length === 0) {
            V.renderTree(val, ch, container, depth + 1, fp);
          }
        });
      })(value, children, fullPath);
      parent.appendChild(folder);
    }
  }
};

VaultChat.openNote = function(path, container) {
  var V = VaultChat;
  V.fetchNote(path).then(function(data) {
    V.renderNoteView(container, data);
  }).catch(function(e) {
    V.showToast('打开失败: ' + e.message);
  });
};

VaultChat.renderNoteView = function(container, note) {
  var V = VaultChat;
  var result = V.stripFrontmatter(note.content);
  var frontmatter = result.frontmatter;
  var body = result.body;
  var html = V.renderMarkdown(body);

  container.innerHTML =
    '<div class="note-viewer">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<button id="back-btn" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:18px">&#8592;</button>' +
        '<h1 style="flex:1;font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          note.path.split('/').pop().replace(/\.md$/, '') +
        '</h1>' +
      '</div>' +
      (frontmatter ? '<div class="frontmatter">' + frontmatter.replace(/\n/g, '<br>') + '</div>' : '') +
      '<div class="md-content">' + html + '</div>' +
      '<div class="note-toolbar">' +
        '<button id="edit-btn">编辑</button>' +
        '<button id="chat-btn" class="primary">与AI对话</button>' +
      '</div>' +
    '</div>';

  container.querySelectorAll('.wiki-link').forEach(function(el) {
    el.addEventListener('click', function() {
      var link = el.dataset.link;
      var found = V.findNotePath(V.state.tree, link);
      if (found) {
        V.fetchNote(found).then(function(data) {
          V.renderNoteView(container, data);
        }).catch(function(e) {});
      } else {
        V.showToast('未找到笔记: ' + link);
      }
    });
  });

  document.getElementById('back-btn').addEventListener('click', function() {
    V.renderNoteBrowser(container);
  });

  document.getElementById('edit-btn').addEventListener('click', function() {
    V.renderNoteEditor(container, note);
  });

  document.getElementById('chat-btn').addEventListener('click', function() {
    V.state.noteContext = [{ path: note.path, content: note.content }];
    document.querySelector('[data-tab="chat"]').click();
  });
};

VaultChat.renderNoteEditor = function(container, note) {
  var V = VaultChat;

  container.innerHTML =
    '<div class="note-editor" style="display:flex;flex-direction:column;height:100%">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<button id="editor-back" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:18px">&#8592;</button>' +
        '<span style="font-size:15px;font-weight:500">' + note.path.split('/').pop() + '</span>' +
      '</div>' +
      '<textarea id="editor-content">' + note.content + '</textarea>' +
      '<div class="editor-actions">' +
        '<button class="btn-cancel" id="editor-cancel">取消</button>' +
        '<button class="btn-save" id="editor-save">保存</button>' +
      '</div>' +
    '</div>';

  document.getElementById('editor-back').addEventListener('click', function() {
    V.renderNoteView(container, note);
  });
  document.getElementById('editor-cancel').addEventListener('click', function() {
    V.renderNoteView(container, note);
  });
  document.getElementById('editor-save').addEventListener('click', function() {
    var content = document.getElementById('editor-content').value;
    V.writeNote(note.path, content, note.sha).then(function(result) {
      V.showToast('保存成功');
      var updated = Object.assign({}, note, { content: content, sha: result.sha });
      V.renderNoteView(container, updated);
    }).catch(function(e) {
      V.showToast('保存失败: ' + e.message);
    });
  });
};

VaultChat.doSearch = function(container) {
  var V = VaultChat;
  var q = document.getElementById('search-input').value.trim();
  if (!q) return;
  var list = document.getElementById('folder-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div>搜索中...</div>';

  V.searchNotes(q).then(function(data) {
    list.innerHTML = '';
    if (data.results.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim);padding:20px">未找到结果</p>';
      return;
    }
    for (var i = 0; i < data.results.length; i++) {
      var item = data.results[i];
      var el = document.createElement('div');
      el.className = 'file-item';
      var displayName = item.path.replace(/\.md$/, '');
      var folderPath = item.path.indexOf('/') !== -1 ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
      el.innerHTML = '<div style="font-weight:500">' + V.escapeHtml(displayName.split('/').pop()) + '</div>' +
        (folderPath ? '<div style="font-size:12px;color:var(--text-dim);margin-top:2px">' + V.escapeHtml(folderPath) + '</div>' : '');
      (function(p) {
        el.addEventListener('click', function() {
          V.fetchNote(p).then(function(noteData) {
            V.renderNoteView(container, noteData);
          }).catch(function(e) {
            V.showToast('打开失败: ' + e.message);
          });
        });
      })(item.path);
      list.appendChild(el);
    }
  }).catch(function(e) {
    list.innerHTML = '<p style="color:var(--danger)">搜索失败: ' + e.message + '</p>';
  });
};

VaultChat.findNotePath = function(tree, name, prefix) {
  prefix = prefix || '';
  var entries = Object.entries(tree);
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    var value = entries[i][1];
    var fullPath = prefix ? prefix + '/' + key : key;
    if (value === null && (key === name || key === name + '.md')) {
      return fullPath;
    }
    if (value !== null) {
      var found = VaultChat.findNotePath(value, name, fullPath);
      if (found) return found;
    }
  }
  return null;
};

VaultChat.escapeHtml = function(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

// --- Chat Panel (v21: with history) ---
VaultChat.chatMessages = [];
VaultChat.chatStreaming = false;

VaultChat.renderChatPanel = function(container) {
  var V = VaultChat;
  V.chatMessages = [];
  V.chatStreaming = false;
  V.state.chatHistoryId = null;

  container.innerHTML =
    '<div class="chat-panel">' +
      '<div class="chat-header">' +
        '<div id="context-badges"></div>' +
        '<button id="chat-history-btn" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:4px 8px;white-space:nowrap">历史</button>' +
      '</div>' +
      '<div id="chat-messages" class="chat-messages">' +
        '<div style="text-align:center;color:var(--text-dim);padding:40px 20px">' +
          '<p style="font-size:16px;margin-bottom:8px">AI 对话</p>' +
          '<p style="font-size:13px">在笔记页面点击"与AI对话"添加上下文<br>或直接输入问题</p>' +
        '</div>' +
      '</div>' +
      '<div class="chat-input-area">' +
        '<textarea id="chat-input" placeholder="输入消息..." rows="1"></textarea>' +
        '<button id="chat-send">发送</button>' +
      '</div>' +
    '</div>';

  V.renderContextBadges();

  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');

  sendBtn.addEventListener('click', function() { V.sendChatMessage(container); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      V.sendChatMessage(container);
    }
  });
  input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  document.getElementById('chat-history-btn').addEventListener('click', function() {
    V.renderChatHistoryList(container);
  });
};

// --- Chat History List ---
VaultChat.renderChatHistoryList = function(container) {
  var V = VaultChat;
  var histories = V.getChatHistories();

  var html =
    '<div class="chat-history-list">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border)">' +
        '<button id="history-back-btn" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:18px">&#8592;</button>' +
        '<h2 style="flex:1;font-size:17px;margin:0">对话历史</h2>' +
        (histories.length > 0 ? '<button id="history-clear-all" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:13px">清空</button>' : '') +
      '</div>';

  if (histories.length === 0) {
    html += '<div style="text-align:center;color:var(--text-dim);padding:60px 20px">' +
      '<p style="font-size:15px">暂无对话记录</p>' +
      '<p style="font-size:13px;margin-top:8px">每次对话会自动保存</p>' +
    '</div>';
  } else {
    html += '<div class="history-items">';
    for (var i = 0; i < histories.length; i++) {
      var h = histories[i];
      var ctxLabel = h.contextPaths && h.contextPaths.length > 0
        ? h.contextPaths.map(function(p) { return p.split('/').pop().replace(/\.md$/, ''); }).join(', ')
        : '';
      html += '<div class="history-item" data-id="' + h.id + '">' +
        '<div class="history-item-main">' +
          '<div class="history-summary">' + V.escapeHtml(h.summary) + '</div>' +
          '<div class="history-meta">' +
            V.formatTimeAgo(h.updatedAt) +
            ' · ' + h.msgCount + '条消息' +
            (ctxLabel ? ' · ' + V.escapeHtml(ctxLabel) : '') +
          '</div>' +
        '</div>' +
        '<button class="history-delete" data-id="' + h.id + '" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;padding:8px;flex-shrink:0">&times;</button>' +
      '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;

  document.getElementById('history-back-btn').addEventListener('click', function() {
    V.renderChatPanel(container);
  });

  if (histories.length > 0) {
    var clearAllBtn = document.getElementById('history-clear-all');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function() {
        if (confirm('确定清空所有对话记录？')) {
          V.saveChatHistories([]);
          V.renderChatHistoryList(container);
        }
      });
    }
  }

  container.querySelectorAll('.history-item-main').forEach(function(el) {
    el.addEventListener('click', function() {
      var id = el.parentElement.dataset.id;
      V.openChatHistory(id, container);
    });
  });

  container.querySelectorAll('.history-delete').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = el.dataset.id;
      if (confirm('删除这条对话记录？')) {
        V.deleteChatHistory(id);
        V.renderChatHistoryList(container);
      }
    });
  });
};

// --- Open a chat history and continue conversation ---
VaultChat.openChatHistory = function(id, container) {
  var V = VaultChat;
  var history = V.loadChatHistory(id);
  if (!history) {
    V.showToast('记录不存在');
    V.renderChatPanel(container);
    return;
  }

  V.chatMessages = history.messages.slice();
  V.state.chatHistoryId = history.id;

  // Restore note context
  if (history.contextPaths && history.contextPaths.length > 0) {
    var token = V.getToken();
    if (token) {
      var promises = history.contextPaths.map(function(p) {
        return V.fetchNote(p).then(function(n) {
          return { path: n.path, content: n.content.substring(0, 2000) };
        }).catch(function() { return null; });
      });
      Promise.all(promises).then(function(results) {
        V.state.noteContext = results.filter(Boolean);
        V.renderChatWithMessages(container, history);
      });
      return;
    }
  }

  V.state.noteContext = [];
  V.renderChatWithMessages(container, history);
};

// --- Render chat with existing messages (from history) ---
VaultChat.renderChatWithMessages = function(container, history) {
  var V = VaultChat;
  V.chatStreaming = false;

  container.innerHTML =
    '<div class="chat-panel">' +
      '<div class="chat-header">' +
        '<div id="context-badges"></div>' +
        '<button id="chat-history-btn" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:4px 8px;white-space:nowrap">历史</button>' +
      '</div>' +
      '<div id="chat-messages" class="chat-messages"></div>' +
      '<div class="chat-input-area">' +
        '<textarea id="chat-input" placeholder="继续对话..." rows="1"></textarea>' +
        '<button id="chat-send">发送</button>' +
      '</div>' +
    '</div>';

  V.renderContextBadges();

  // Render all existing messages
  var msgArea = document.getElementById('chat-messages');
  var html = '';
  for (var i = 0; i < V.chatMessages.length; i++) {
    var m = V.chatMessages[i];
    if (m.role === 'user') {
      html += '<div class="chat-msg user"><div class="bubble">' + V.escapeHtml(m.content) + '</div></div>';
    } else {
      html += '<div class="chat-msg assistant"><div class="bubble">' + V.formatChatText(m.content);
      if (i === V.chatMessages.length - 1) {
        html += '<button class="chat-save-btn" onclick="VaultChat.saveChatToNote(\'' + history.id + '\')">保存到笔记</button>';
      }
      html += '</div></div>';
    }
  }
  msgArea.innerHTML = html;
  msgArea.scrollTop = msgArea.scrollHeight;

  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');

  sendBtn.addEventListener('click', function() { V.sendChatMessage(container); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      V.sendChatMessage(container);
    }
  });
  input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  document.getElementById('chat-history-btn').addEventListener('click', function() {
    V.saveCurrentChat();
    V.renderChatHistoryList(container);
  });
};

VaultChat.renderContextBadges = function() {
  var V = VaultChat;
  var badges = document.getElementById('context-badges');
  if (!badges) return;
  var html = V.state.noteContext.map(function(n, i) {
    return '<span class="context-badge">' +
      n.path.split('/').pop().replace(/\.md$/, '') +
      '<span class="remove-ctx" data-idx="' + i + '">&times;</span>' +
    '</span>';
  }).join('');
  badges.innerHTML = html;

  badges.querySelectorAll('.remove-ctx').forEach(function(el) {
    el.addEventListener('click', function() {
      V.state.noteContext.splice(parseInt(el.dataset.idx), 1);
      V.renderContextBadges();
    });
  });
};

VaultChat.localSearch = function(query, limit) {
  var V = VaultChat;
  if (!V.state.tree) return [];
  limit = limit || 3;
  var keywords = query.replace(/[，。！？、；：""''（）\[\]{}.,!?;:'"()\s]+/g, ' ').split(' ').filter(function(k) { return k.length > 1; });
  var allPaths = [];
  V._collectPaths(V.state.tree, '', allPaths);
  var scored = [];
  for (var i = 0; i < allPaths.length; i++) {
    var p = allPaths[i];
    var score = 0;
    for (var j = 0; j < keywords.length; j++) {
      if (p.indexOf(keywords[j]) !== -1) score += 2;
      var lower = p.toLowerCase();
      if (lower.indexOf(keywords[j].toLowerCase()) !== -1) score += 1;
    }
    if (score > 0) scored.push({ path: p, score: score });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, limit).map(function(s) { return s.path; });
};

VaultChat._collectPaths = function(tree, prefix, result) {
  var keys = Object.keys(tree);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = tree[k];
    var fp = prefix ? prefix + '/' + k : k;
    if (v === null) {
      result.push(fp);
    } else {
      VaultChat._collectPaths(v, fp, result);
    }
  }
};

VaultChat.sendChatMessage = function(container) {
  var V = VaultChat;
  if (V.chatStreaming) return;

  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;

  V.chatMessages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';

  V.renderChatHistory();

  var msgArea = document.getElementById('chat-messages');
  var assistantDiv = document.createElement('div');
  assistantDiv.className = 'chat-msg assistant';
  assistantDiv.innerHTML = '<div class="bubble"><div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div> 思考中...</div>';
  msgArea.appendChild(assistantDiv);
  msgArea.scrollTop = msgArea.scrollHeight;

  V.chatStreaming = true;
  var fullText = '';

  if (V.state.noteContext.length === 0 && V.getToken() && V.state.tree) {
    assistantDiv.querySelector('.bubble').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div> 搜索知识库...';

    var matchedPaths = V.localSearch(text, 3);
    if (matchedPaths.length > 0) {
      var promises = matchedPaths.map(function(p) { return V.fetchNote(p); });
      Promise.all(promises).then(function(notes) {
        V.state.noteContext = notes.map(function(n) { return { path: n.path, content: n.content.substring(0, 2000) }; });
        V.renderContextBadges();
        doStreamChat();
      }).catch(function() {
        doStreamChat();
      });
    } else {
      doStreamChat();
    }
  } else {
    doStreamChat();
  }

  function doStreamChat() {
    assistantDiv.querySelector('.bubble').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div> 思考中...';
    V.streamChat(
      V.chatMessages,
      V.state.noteContext,
      null,
      function(chunk) {
        fullText += chunk;
        assistantDiv.querySelector('.bubble').innerHTML = V.formatChatText(fullText);
        msgArea.scrollTop = msgArea.scrollHeight;
      },
      function() {
        V.chatMessages.push({ role: 'assistant', content: fullText });
        V.chatStreaming = false;
        // Auto-save to history
        V.saveCurrentChat();
        var saveBtn = document.createElement('button');
        saveBtn.className = 'chat-save-btn';
        saveBtn.textContent = '保存到笔记';
        saveBtn.addEventListener('click', function() { V.saveChatToNote(fullText); });
        assistantDiv.querySelector('.bubble').appendChild(saveBtn);
      }
    ).catch(function(e) {
      assistantDiv.querySelector('.bubble').innerHTML = '<span style="color:var(--danger)">' + e.message + '</span>';
      V.chatStreaming = false;
    });
  }
};

VaultChat.renderChatHistory = function() {
  var V = VaultChat;
  var msgArea = document.getElementById('chat-messages');
  var assistantMsgs = Array.from(msgArea.querySelectorAll('.chat-msg.assistant'));
  var html = V.chatMessages
    .filter(function(m) { return m.role === 'user'; })
    .map(function(m) {
      return '<div class="chat-msg user"><div class="bubble">' + V.escapeHtml(m.content) + '</div></div>';
    })
    .join('');
  msgArea.innerHTML = html;
  assistantMsgs.forEach(function(el) { msgArea.appendChild(el); });
  msgArea.scrollTop = msgArea.scrollHeight;
};

VaultChat.saveChatToNote = function(assistantText) {
  var V = VaultChat;
  var now = new Date();
  var dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  var timeStr = now.toTimeString().slice(0, 5).replace(/:/, '');
  var fileName = 'AI对话-' + dateStr + '-' + timeStr + '.md';
  var path = '04 输出成果/' + fileName;

  var contextNames = V.state.noteContext.map(function(n) { return n.path; }).join(', ');
  var content = '---\ntags: [AI对话]\ndate: ' + now.toISOString() + '\ncontext: "' + contextNames + '"\n---\n\n# AI对话 ' + dateStr + '\n\n' +
    V.chatMessages.map(function(m) {
      return (m.role === 'user' ? '**我**: ' + m.content + '\n\n' : '**AI**: ' + m.content + '\n\n');
    }).join('');

  V.writeNote(path, content).then(function() {
    V.showToast('已保存到笔记');
  }).catch(function(e) {
    V.showToast('保存失败: ' + e.message);
  });
};

VaultChat.formatChatText = function(text) {
  var html = VaultChat.escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
};

// --- App Shell ---
VaultChat.renderApp = function(container) {
  var V = VaultChat;
  var hasToken = !!V.getToken();
  V.state.currentTab = 'notes';

  container.innerHTML =
    '<div class="main-layout">' +
      '<div class="main-content">' +
        '<div id="tab-notes" class="tab-panel active"></div>' +
        '<div id="tab-chat" class="tab-panel"></div>' +
        '<div id="tab-settings" class="tab-panel"></div>' +
      '</div>' +
      '<nav class="tab-bar">' +
        '<button class="active" data-tab="notes">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' +
          '<span>笔记</span>' +
        '</button>' +
        '<button data-tab="chat">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
          '<span>对话</span>' +
        '</button>' +
        '<button data-tab="settings">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' +
          '<span>设置</span>' +
        '</button>' +
      '</nav>' +
    '</div>';

  var tabs = container.querySelectorAll('.tab-bar button');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = tab.dataset.tab;
      if (target === V.state.currentTab) return;
      V.state.currentTab = target;

      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('tab-' + target).classList.add('active');

      if (target === 'notes' && !document.getElementById('tab-notes').dataset.init) {
        V.renderNoteBrowser(document.getElementById('tab-notes'));
        document.getElementById('tab-notes').dataset.init = '1';
      } else if (target === 'chat' && !document.getElementById('tab-chat').dataset.init) {
        V.renderChatPanel(document.getElementById('tab-chat'));
        document.getElementById('tab-chat').dataset.init = '1';
      } else if (target === 'settings' && !document.getElementById('tab-settings').dataset.init) {
        V.renderSettings(document.getElementById('tab-settings'));
        document.getElementById('tab-settings').dataset.init = '1';
      }
    });
  });

  if (hasToken) {
    V.renderNoteBrowser(document.getElementById('tab-notes'));
  } else {
    document.getElementById('tab-notes').innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:var(--text-dim)">' +
        '<p style="font-size:18px;margin-bottom:12px;color:var(--text)">欢迎使用王者之剑</p>' +
        '<p style="margin-bottom:20px">请先在「设置」中配置 GitHub Token</p>' +
        '<button id="go-settings" style="padding:12px 24px;border:none;border-radius:12px;background:var(--accent);color:white;font-size:15px;cursor:pointer">前往设置</button>' +
      '</div>';
    document.getElementById('go-settings').addEventListener('click', function() {
      document.querySelector('[data-tab="settings"]').click();
    });
  }
  document.getElementById('tab-notes').dataset.init = '1';
};

// ============ INSTALL GUIDE ============

VaultChat.showInstallGuide = function() {
  var V = VaultChat;
  var ua = navigator.userAgent || '';
  var isHuaweiBrowser = ua.indexOf('HuaweiBrowser') !== -1 || ua.indexOf('HUAWEI') !== -1 ||
    ua.indexOf('HarmonyOS') !== -1 || (ua.indexOf('Chrome') === -1 && ua.indexOf('Safari') !== -1);
  var isChrome = ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1;

  var existing = document.getElementById('install-guide-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'install-guide-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

  var chromeSteps = [
    '1. 点浏览器右上角 <b>⋮</b>（三个点）',
    '2. 找到 <b>"添加到主屏幕"</b> 或 <b>"安装应用"</b>',
    '3. 点确认即可，桌面会出现App图标',
    '',
    '<span style="color:#f59e0b">提示：华为手机Chrome可能不显示"安装应用"，请选"添加到主屏幕"</span>'
  ];

  var huaweiSteps = [
    '1. 点浏览器底部 <b>⋮⋮</b> 或 <b>四条杠</b> 菜单按钮',
    '2. 找到 <b>"添加到主屏幕"</b>',
    '3. 点确认即可，桌面会出现图标',
    '',
    '<span style="color:#f59e0b">提示：部分华为浏览器在「收藏」→「添加书签」后，长按书签可添加到桌面</span>'
  ];

  var steps = isHuaweiBrowser ? huaweiSteps : chromeSteps;
  var browserName = isHuaweiBrowser ? '华为浏览器' : (isChrome ? 'Chrome浏览器' : '浏览器');

  var guideHtml =
    '<div style="background:#1e1e3a;border-radius:16px;padding:24px;max-width:360px;width:100%;max-height:80vh;overflow-y:auto;color:white">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<h3 style="margin:0;font-size:18px">安装到手机桌面</h3>' +
        '<button id="install-guide-close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;padding:4px">&times;</button>' +
      '</div>' +
      '<div style="background:rgba(124,92,255,0.15);border-radius:12px;padding:14px;margin-bottom:16px">' +
        '<div style="font-size:14px;font-weight:bold;margin-bottom:6px">当前浏览器：' + browserName + '</div>' +
        '<div style="font-size:12px;color:#a0a0c0">华为手机没有Google服务，需手动添加到桌面</div>' +
      '</div>' +
      '<div style="font-size:14px;line-height:2">' +
        steps.join('<br>') +
      '</div>' +
      '<div style="margin-top:20px;padding:14px;background:rgba(34,197,94,0.1);border-radius:12px;border:1px solid rgba(34,197,94,0.3)">' +
        '<div style="font-size:13px;font-weight:bold;color:#22c55e;margin-bottom:8px">添加后的效果：</div>' +
        '<div style="font-size:12px;color:#a0a0c0;line-height:1.6">' +
          '- 桌面有独立图标，像App一样打开<br>' +
          '- 打开后全屏显示，无地址栏<br>' +
          '- 随时访问知识库和AI对话' +
        '</div>' +
      '</div>' +
      (isChrome && !isHuaweiBrowser ?
        '<div style="margin-top:16px;padding:14px;background:rgba(59,130,246,0.1);border-radius:12px;border:1px solid rgba(59,130,246,0.3)">' +
          '<div style="font-size:13px;font-weight:bold;color:#3b82f6;margin-bottom:8px">备用方案：用华为浏览器</div>' +
          '<div style="font-size:12px;color:#a0a0c0;line-height:1.6">' +
            '如果Chrome菜单里找不到"添加到主屏幕"，可以：<br>' +
            '1. 复制当前网址<br>' +
            '2. 打开华为浏览器<br>' +
            '3. 粘贴网址打开<br>' +
            '4. 点底部菜单 → 添加到主屏幕' +
          '</div>' +
        '</div>'
      : '') +
      '<button id="install-guide-done" style="width:100%;margin-top:20px;padding:12px;border:none;border-radius:12px;background:#7c5cff;color:white;font-size:15px;cursor:pointer;font-weight:bold">我知道了</button>' +
    '</div>';

  modal.innerHTML = guideHtml;
  document.body.appendChild(modal);

  document.getElementById('install-guide-close').addEventListener('click', function() {
    modal.remove();
  });
  document.getElementById('install-guide-done').addEventListener('click', function() {
    modal.remove();
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
};

// ============ PWA INSTALL ============

VaultChat.deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  VaultChat.deferredInstallPrompt = e;
});

// ============ AUTH / INIT ============

(function() {
  var V = VaultChat;
  var app = document.getElementById('app');

  // Intercept all external link clicks — open in system browser, not inside PWA
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href) return;
    // Skip internal/hash/javascript links
    if (href.indexOf('#') === 0 || href.indexOf('javascript:') === 0) return;
    // Skip vault-relative links
    if (href.indexOf('/') === 0 && href.indexOf('//') !== 0) return;
    // External link — open in system browser, not inside PWA
    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) {
      e.preventDefault();
      e.stopPropagation();
      // Create a temporary link outside the app container to force system browser
      var tmpLink = document.createElement('a');
      tmpLink.href = href;
      tmpLink.target = '_blank';
      tmpLink.rel = 'noopener noreferrer';
      tmpLink.style.display = 'none';
      document.body.appendChild(tmpLink);
      tmpLink.click();
      setTimeout(function() { tmpLink.remove(); }, 100);
    }
  });

  var params = new URLSearchParams(window.location.search);
  var shouldCleanUrl = false;
  var urlToken = params.get('token');
  if (urlToken) {
    V.setToken(urlToken);
    params.delete('token');
    shouldCleanUrl = true;
  }
  var urlKey = params.get('key');
  var urlProvider = params.get('provider');
  if (urlKey || urlProvider) {
    var settings = V.getSettings();
    var newSettings = Object.assign({}, settings);
    if (urlKey) newSettings.apiKey = urlKey;
    if (urlProvider) newSettings.provider = urlProvider;
    V.saveSettings(newSettings);
    params.delete('key');
    params.delete('provider');
    shouldCleanUrl = true;
  }
  if (shouldCleanUrl) {
    var cleanUrl = params.toString()
      ? window.location.pathname + '?' + params.toString()
      : window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  if (V.isSetupDone() && V.isLoggedIn()) {
    V.renderApp(app);
  } else {
    V.renderLogin(app);
  }
})();
