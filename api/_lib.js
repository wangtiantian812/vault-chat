const crypto = require('crypto');

const GH = {
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || 'main',
};

function ghUrl(path) {
  return `https://api.github.com/repos/${GH.owner}/${GH.repo}${path}`;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GH.token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'vault-chat',
  };
}

async function ghFetch(path, options = {}) {
  const res = await fetch(ghUrl(path), {
    ...options,
    headers: { ...ghHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res;
}

function verifyAuth(req) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return false;
  const expected = crypto
    .createHmac('sha256', process.env.APP_PASSWORD)
    .update('vault-chat-auth')
    .digest('hex');
  return auth === expected;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

module.exports = { GH, ghUrl, ghHeaders, ghFetch, verifyAuth, corsHeaders };
