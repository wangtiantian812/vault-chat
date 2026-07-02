const { ghFetch, verifyAuth, GH } = require('../_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: '缺少搜索关键词 q' });
  }

  try {
    const query = `${q} repo:${GH.owner}/${GH.repo} path:*.md`;
    const response = await ghFetch(
      `/search/code?q=${encodeURIComponent(query)}&per_page=20`
    );
    const data = await response.json();

    const results = (data.items || []).map((item) => ({
      path: item.path,
      name: item.name,
    }));

    res.status(200).json({ results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
