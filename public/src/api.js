const GH_API = 'https://api.github.com';
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const CORS_PROXY = 'https://corsproxy.io/?url=';

const OWNER = 'wangtiantian812';
const REPO = 'obsidian-vault';
const BRANCH = 'main';

function ghHeaders() {
  const token = localStorage.getItem('gh-token');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

export async function fetchTree() {
  const res = await fetch(
    `${GH_API}/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error(`获取文件树失败: ${res.status}`);
  const data = await res.json();
  const mdFiles = data.tree
    .filter((item) => item.type === 'blob' && item.path.endsWith('.md'));
  const tree = {};
  for (const filePath of mdFiles) {
    const parts = filePath.split('/');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = null;
  }
  return { tree };
}

export async function fetchNote(path) {
  const encoded = encodeURIComponent(path);
  const res = await fetch(
    `${GH_API}/repos/${OWNER}/${REPO}/contents/${encoded}?ref=${BRANCH}`,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error(`获取笔记失败: ${res.status}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ''));
  const decoded = decodeURIComponent(escape(content));
  return { path, content: decoded, sha: data.sha };
}

export async function searchNotes(q) {
  const query = `${q} repo:${OWNER}/${REPO} path:*.md`;
  const res = await fetch(
    `${GH_API}/search/code?q=${encodeURIComponent(query)}&per_page=20`,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error(`搜索失败: ${res.status}`);
  const data = await res.json();
  const results = (data.items || []).map((item) => ({
    path: item.path,
    name: item.name,
  }));
  return { results, total: results.length };
}

export async function writeNote(path, content, sha) {
  const encoded = encodeURIComponent(path);
  const body = {
    message: `Vault Chat更新: ${path.split('/').pop()}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `${GH_API}/repos/${OWNER}/${REPO}/contents/${encoded}`,
    {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `保存失败: ${res.status}`);
  }
  const data = await res.json();
  return { ok: true, sha: data.content?.sha || data.commit?.sha };
}

export async function streamChat(messages, noteContext, apiKey, onChunk, onDone) {
  const settings = getSettings();
  const key = apiKey || settings.apiKey;
  if (!key) throw new Error('未配置AI密钥，请在设置中填入 Claude API Key');

  const systemPrompt = `你是"王者之剑"知识库的AI助手。用户可能引用了以下笔记作为上下文：

${noteContext?.map((n) => `--- 文件: ${n.path} ---\n${n.content}\n`).join('\n') || '（无笔记上下文）'}

请用中文回答。基于提供的笔记内容进行回答，如果笔记中没有相关信息请说明。`;

  const targetUrl = encodeURIComponent(CLAUDE_API);
  const res = await fetch(`${CORS_PROXY}${targetUrl}`, {
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
    const data = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(data.error?.message || data.error || '聊天请求失败');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta'
          ) {
            onChunk(parsed.delta.text);
          } else if (parsed.type === 'message_stop') {
            onDone?.();
            return;
          }
        } catch (e) {}
      }
    }
  }
  onDone?.();
}

function getSettings() {
  const raw = localStorage.getItem('vault-chat-settings');
  if (!raw) return { apiKey: '' };
  try { return JSON.parse(raw); } catch (e) { return { apiKey: ''; } }
}
