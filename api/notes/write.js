const { ghFetch, verifyAuth } = require('../_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { path, content, sha } = req.body || {};
  if (!path || content === undefined) {
    return res.status(400).json({ error: '缺少 path 或 content' });
  }

  try {
    const encodedPath = encodeURIComponent(path);
    const body = {
      message: `通过Vault Chat更新: ${path.split('/').pop()}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: process.env.GITHUB_BRANCH || 'main',
    };
    if (sha) body.sha = sha;

    const result = await ghFetch(`/contents/${encodedPath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await result.json();

    res.status(200).json({ ok: true, sha: data.content?.sha || data.commit?.sha });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
