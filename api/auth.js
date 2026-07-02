const crypto = require('crypto');
const { corsHeaders } = require('./_lib');

module.exports = async function handler(req, res) {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = crypto
    .createHmac('sha256', process.env.APP_PASSWORD)
    .update('vault-chat-auth')
    .digest('hex');

  res.status(200).json({ token });
};
