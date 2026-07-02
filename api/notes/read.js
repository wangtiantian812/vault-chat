const { ghFetch, verifyAuth } = require('../_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  const notePath = req.query.path;
  if (!notePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  try {
    const encodedPath = encodeURIComponent(notePath);
    const response = await ghFetch(`/contents/${encodedPath}`);
    const data = await response.json();

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    res.status(200).json({ path: notePath, content, sha: data.sha });
  } catch (err) {
    if (err.message.includes('404')) {
      return res.status(404).json({ error: '笔记未找到' });
    }
    res.status(500).json({ error: err.message });
  }
};
