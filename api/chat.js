const { verifyAuth } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('access-control-allow-origin', '*').send('');
  }
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: '未授权' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { messages, noteContext, apiKey } = req.body || {};
  const claudeKey = apiKey || process.env.CLAUDE_API_KEY;
  if (!claudeKey) {
    return res.status(400).json({ error: '未配置AI密钥，请在设置中填入' });
  }

  const systemPrompt = `你是"王者之剑"知识库的AI助手。用户可能引用了以下笔记作为上下文：

${noteContext?.map((n) => `--- 文件: ${n.path} ---\n${n.content}\n`).join('\n') || '（无笔记上下文）'}

请用中文回答。基于提供的笔记内容进行回答，如果笔记中没有相关信息请说明。`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
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

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `Claude API错误: ${errBody}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                res.write(
                  `data: ${JSON.stringify({ type: 'text', text: parsed.delta.text })}\n\n`
                );
              } else if (parsed.type === 'message_stop') {
                res.write('data: [DONE]\n\n');
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      // Client disconnected, that's fine
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
