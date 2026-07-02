const API_BASE = '';

export async function api(path, options = {}) {
  const token = localStorage.getItem('auth-token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth-token');
    location.reload();
  }
  return res;
}

export async function login(password) {
  const res = await fetch(`${API_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || '登录失败');
  }
  const data = await res.json();
  localStorage.setItem('auth-token', data.token);
  return data;
}

export async function fetchTree() {
  const res = await api('/api/notes/tree');
  if (!res.ok) throw new Error('获取文件树失败');
  return res.json();
}

export async function fetchNote(path) {
  const res = await api(`/api/notes/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('获取笔记失败');
  return res.json();
}

export async function searchNotes(q) {
  const res = await api(`/api/notes/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('搜索失败');
  return res.json();
}

export async function writeNote(path, content, sha) {
  const res = await api('/api/notes/write', {
    method: 'PUT',
    body: JSON.stringify({ path, content, sha }),
  });
  if (!res.ok) throw new Error('保存失败');
  return res.json();
}

export async function streamChat(messages, noteContext, apiKey, onChunk, onDone) {
  const token = localStorage.getItem('auth-token');
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, noteContext, apiKey }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(data.error || '聊天请求失败');
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
          if (parsed.type === 'text') {
            onChunk(parsed.text);
          }
        } catch {}
      }
    }
  }
  onDone?.();
}
