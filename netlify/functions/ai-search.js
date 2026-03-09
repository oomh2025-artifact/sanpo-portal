exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY が設定されていません' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, query, articles } = body;

  async function callClaude(prompt, maxTokens = 300) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  try {
    // --- キーワード抽出 ---
    if (action === 'extract_keywords') {
      const keywords = await callClaude(
        `以下の質問から、J-STAGEで産業保健分野の論文を検索するための日本語キーワードを1〜3個抽出してください。\nカンマ区切りで出力し、それ以外は何も出力しないでください。\n\n質問: ${query}`,
        100
      );
      return { statusCode: 200, headers, body: JSON.stringify({ keywords: keywords.trim() }) };
    }

    // --- 回答生成 ---
    if (action === 'summarize') {
      const articleList = (articles || [])
        .map((a, i) => `${i + 1}. ${a.title}（${a.journal || ''} ${a.year || ''}年 ${a.volume || ''}巻）\n   ${a.link || ''}`)
        .join('\n');

      const answer = await callClaude(
        `あなたは産業保健の専門家です。以下の質問について、見つかった論文リストを参考に実務者向けに回答してください。

質問: ${query}

見つかった論文:
${articleList || 'なし'}

回答ルール:
- まず質問への概要回答を2〜3文で述べる
- 主要ポイントを箇条書きで整理
- 実務での活用ポイントがあれば追記
- 日本語で、簡潔で実用的な文体
- 論文が見つからない場合は一般知識で回答し、その旨を明記`,
        1500
      );

      const sources = (articles || []).slice(0, 5).map(a => ({
        title: a.title,
        link: a.link,
        type: a.journal || '',
        meta: a.year ? `${a.year}年 ${a.volume || ''}巻` : ''
      }));

      return { statusCode: 200, headers, body: JSON.stringify({ answer, sources }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
