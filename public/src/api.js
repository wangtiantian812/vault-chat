var GH_API = 'https://api.github.com';
var CLAUDE_API = 'https://api.anthropic.com/v1/messages';
var CORS_PROXY = 'https://corsproxy.io/?url=';

var OWNER = 'wangtiantian812';
var REPO = 'obsidian-vault';
var BRANCH = 'main';

function ghHeaders() {
  var token = localStorage.getItem('gh-token');
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github.v3+json',
  };
}

export async function fetchTree() {
  var res = await fetch(
    GH_API + '/repos/' + OWNER + '/' + REPO + '/git/trees/' + BRANCH + '?recursive=1',
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error('获取文件树失败: ' + res.status);
  var data = await res.json();
  var mdFiles = data.tree
    .filter(function(item) { return item.type === 'blob' && item.path.endsWith('.md'); });
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
}

export async function fetchNote(path) {
  var encoded = encodeURIComponent(path);
  var res = await fetch(
    GH_API + '/repos/' + OWNER + '/' + REPO + '/contents/' + encoded + '?ref=' + BRANCH,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error('获取笔记失败: ' + res.status);
  var data = await res.json();
  var content = atob(data.content.replace(/\n/g, ''));
  var decoded = decodeURIComponent(escape(content));
  return { path: path, content: decoded, sha: data.sha };
}

export async function searchNotes(q) {
  var query = q + ' repo:' + OWNER + '/' + REPO + ' path:*.md';
  var res = await fetch(
    GH_API + '/search/code?q=' + encodeURIComponent(query) + '&per_page=20',
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error('搜索失败: ' + res.status);
  var data = await res.json();
  var results = (data.items || []).map(function(item) {
    return { path: item.path, name: item.name };
  });
  return { results: results, total: results.length };
}

export async function writeNote(path, content, sha) {
  var encoded = encodeURIComponent(path);
  var body = {
    message: 'Vault Chat更新: ' + path.split('/').pop(),
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  var res = await fetch(
    GH_API + '/repos/' + OWNER + '/' + REPO + '/contents/' + encoded,
    {
      method: 'PUT',
      headers: Object.assign({}, ghHeaders(), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    throw new Error(err.message || '保存失败: ' + res.status);
  }
  var data = await res.json();
  var contentSha = (data.content && data.content.sha) || (data.commit && data.commit.sha);
  return { ok: true, sha: contentSha };
}

export async function streamChat(messages, noteContext, apiKey, onChunk, onDone) {
  var settings = getSettings();
  var key = apiKey || settings.apiKey;
  if (!key) throw new Error('未配置AI密钥，请在设置中填入 Claude API Key');

  var noteCtxText = '（无笔记上下文）';
  if (noteContext && noteContext.length > 0) {
    noteCtxText = noteContext.map(function(n) {
      return '--- 文件: ' + n.path + ' ---\n' + n.content + '\n';
    }).join('\n');
  }

  var systemPrompt = '你是"王者之剑"知识库的AI助手。用户可能引用了以下笔记作为上下文：\n\n' +
    noteCtxText + '\n\n请用中文回答。基于提供的笔记内容进行回答，如果笔记中没有相关信息请说明。';

  var targetUrl = encodeURIComponent(CLAUDE_API);
  var res = await fetch(CORS_PROXY + targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages || [],
      stream: true,
    }),
  });

  if (!res.ok) {
    var data = await res.json().catch(function() { return { error: '请求失败' }; });
    var errMsg = (data.error && data.error.message) || data.error || '聊天请求失败';
    throw new Error(errMsg);
  }

  var reader = res.body.getReader();
  var decoder = new TextDecoder();

  while (true) {
    var result = await reader.read();
    if (result.done) break;
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
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta && parsed.delta.type === 'text_delta'
          ) {
            onChunk(parsed.delta.text);
          } else if (parsed.type === 'message_stop') {
            if (onDone) onDone();
            return;
          }
        } catch (e) {}
      }
    }
  }
  if (onDone) onDone();
}

function getSettings() {
  var raw = localStorage.getItem('vault-chat-settings');
  if (!raw) return { apiKey: '' };
  try { return JSON.parse(raw); } catch (e) { return { apiKey: '' }; }
}
