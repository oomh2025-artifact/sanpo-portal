const https = require('https');

// Claude API呼び出し
function callClaude(apiKey, messages, maxTokens = 2048) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: messages
    });
    
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };
    
    const req = https.request(options, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// レスポンスからテキスト抽出
function extractText(response) {
  if (!response.content) return '';
  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

// メインハンドラー
exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }
  
  try {
    const { action, query, articles } = JSON.parse(event.body);
    
    // アクション1: キーワード抽出
    if (action === 'extract_keywords') {
      console.log('Extracting keywords from:', query);
      
      const response = await callClaude(apiKey, [{
        role: 'user',
        content: `以下の質問から、論文検索に使用する日本語キーワードを2〜3個抽出してください。
キーワードのみをカンマ区切りで出力してください。説明は不要です。

質問: ${query}

出力例: ストレスチェック, メンタルヘルス, 職場`
      }], 100);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const keywords = extractText(response).trim();
      console.log('Extracted keywords:', keywords);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ keywords })
      };
    }
    
    // アクション2: 論文をまとめて回答生成（公的資料もWeb検索）
    if (action === 'summarize') {
      console.log('Summarizing with', articles?.length || 0, 'articles');
      
      let articlesContext = '';
      if (articles && articles.length > 0) {
        articlesContext = '\n\n【検索された論文】\n';
        articles.slice(0, 5).forEach((r, i) => {
          articlesContext += `\n${i + 1}. ${r.title}\n`;
          articlesContext += `   雑誌: ${r.journal} ${r.year}年\n`;
          if (r.abstract) articlesContext += `   抄録: ${r.abstract.substring(0, 150)}...\n`;
        });
      }
      
      // Web検索付きでClaude APIを呼び出し（厚労省1回のみ）
      const requestBody = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 1
          }
        ],
        messages: [{
          role: 'user',
          content: `産業保健の専門家として回答してください。

【質問】${query}

${articlesContext}

【指示】
1. 厚生労働省(mhlw.go.jp)で関連情報を検索
2. 論文と公的資料を統合して回答（400-600字）

【回答パターン】質問に応じて適切な構造を選ぶ
・「現状と対策」「〜について教えて」→ ■現状 ■対策 の構造
・「論文を教えて」「研究はある？」→ 論文を箇条書きで紹介し、各論文の要点を説明
・「〜とは」「定義は？」→ 定義を最初に述べ、背景・実務での扱いを説明
・「方法」「手順」「どうすれば」→ 番号付きステップ形式（1. 2. 3.）
・「比較」「違い」→ 表形式か対比構造で説明
・「義務？」「法律は？」→ 根拠法令を明示し、罰則や届出要件を具体的に
・「いつから」「期限は」→ 日付・期間を冒頭で明示
・自由質問・雑談 → 見出しなしで自然な文章

【文章ルール】※厳守
・1文は短く（50字以内目安）。1文に1つの情報だけ入れる
・接続詞（〜が、〜ので）で長くつなげない。文を分ける
・二重否定は使わない（×届け出なければならない → ○届け出てください）
・受身形・使役形は避ける（×提出された → ○提出しました）
・敬語は「です・ます」に統一。尊敬語・謙譲語は避ける
・曖昧な表現を避け具体的に（×なるべく早く → ○3日以内に）
・専門用語はそのまま使ってOK。ただし必要なら〈 〉で補足

【表記ルール】
・見出しは「■」を使う（「##」「###」は使わない）
・太字「**」は使わない
・箇条書きは「・」を使う
・手順は「1. 2. 3.」を使う
・参考URLは最後にまとめる`
        }]
      });
      
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      };
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          res.setEncoding('utf8');
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.write(requestBody);
        req.end();
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const answer = extractText(response);
      
      const sources = (articles || []).slice(0, 5).map(r => ({
        title: r.title,
        link: r.link,
        type: '📄 論文',
        meta: `${r.journal} ${r.year}年`
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ answer, sources })
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action. Use "extract_keywords" or "summarize"' })
    };
    
  } catch (e) {
    console.error('Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
