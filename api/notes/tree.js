const { ghFetch, verifyAuth, GH } = require('../_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  try {
    const branch = GH.branch || 'main';
    const response = await ghFetch(`/git/trees/${branch}?recursive=1`);
    const data = await response.json();

    const mdFiles = data.tree
      .filter((item) => item.type === 'blob' && item.path.endsWith('.md'))
      .map((item) => item.path);

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

    res.status(200).json({ tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
