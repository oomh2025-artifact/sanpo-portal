const https = require('https');

// J-STAGE検索対象の6誌
const TARGET_JOURNALS = ['sangyoeisei', 'indhealth', 'ohpfrev', 'jjomh', 'jaohn', 'jaohl'];
const JOURNAL_NAMES = {
  'sangyoeisei': '産業衛生学雑誌',
  'indhealth': 'Industrial Health',
  'ohpfrev': '産業医学レビュー',
  'jjomh': '産業精神保健',
  'jaohn': '日本産業看護学会誌',
  'jaohl': '産業保健法学会誌'
};

// J-STAGE APIで論文検索
function searchJstage(keyword) {
  return new Promise((resolve, reject) => {
    const journalParam = TARGET_JOURNALS.map(j => `cdjournal=${j}`).join('&');
    const url = `https://api.jstage.jst.go.jp/searchapi/do?service=3&keyword=${encodeURIComponent(keyword)}&count=10&${journalParam}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// J-STAGE XMLをパース
function parseJstageResults(xml) {
  const results = [];
  const entries = xml.split('<entry>').slice(1);
  
  for (const entry of entries) {
    let title = '';
    let m = entry.match(/article_title[\s\S]*?<ja>[\s\S]*?CDATA\[([\s\S]*?)\]\]/);
    if (m) title = m[1].trim();
    if (!title) {
      m = entry.match(/article_title[\s\S]*?<en>[\s\S]*?CDATA\[([\s\S]*?)\]\]/);
      if (m) title = m[1].trim();
    }
    
    if (!title || title.length < 5) continue;
    
    // 抄録
    let abstract = '';
    const absMatch = entry.match(/<abstract>([\s\S]*?)<\/abstract>/);
    if (absMatch) {
      let absJa = absMatch[1].match(/<ja>[\s\S]*?CDATA\[([\s\S]*?)\]\]/);
      if (absJa) abstract = absJa[1].trim();
      else {
        let absEn = absMatch[1].match(/<en>[\s\S]*?CDATA\[([\s\S]*?)\]\]/);
        if (absEn) abstract = absEn[1].trim();
      }
    }
    if (abstract.length > 300) abstract = abstract.substring(0, 300) + '...';
    
    // 雑誌名
    const cdj = entry.match(/cdjournal>([^<]+)</);
    const journal = cdj ? (JOURNAL_NAMES[cdj[1]] || cdj[1]) : '';
    
    // メタ情報
    const vol = entry.match(/volume>(\d+)</);
    const num = entry.match(/number>([^<]+)</);
    const year = entry.match(/pubyear>(\d+)</);
    const link = entry.match(/link[^>]*href="([^"]+)"/);
    
    results.push({
      title,
      abstract,
      journal,
      year: year ? year[1] : '',
      volume: vol ? vol[1] : '',
      number: num ? num[1] : '',
      link: link ? link[1] : ''
    });
  }
  
  return results.slice(0, 5);
}

// Claude API呼び出し（Web検索なし - 高速版）
function callClaude(query, jstageResults) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      reject(new Error('ANTHROPIC_API_KEY is not set'));
      return;
    }
    
    // J-STAGEの結果をテキスト化
    let jstageContext = '';
    if (jstageResults.length > 0) {
      jstageContext = '\n\n【J-STAGE論文検索結果】\n';
      jstageResults.forEach((r, i) => {
        jstageContext += `\n${i + 1}. ${r.title}\n`;
        jstageContext += `   雑誌: ${r.journal} ${r.year}年 ${r.volume}巻${r.number}号\n`;
        if (r.abstract) jstageContext += `   抄録: ${r.abstract}\n`;
        jstageContext += `   URL: ${r.link}\n`;
      });
    }
    
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `あなたは産業保健の専門家アシスタントです。以下の質問に対して、提供された論文情報を活用して回答してください。

【質問】
${query}

${jstageContext}

【指示】
1. 質問への直接的な回答（200-300字程度）
2. 論文から得られる重要なポイントを箇条書きで整理
3. 回答は日本語で、産業医や産業保健スタッフが実務で活用できる実践的な内容にしてください。
4. 論文情報がない場合は、一般的な知識で回答し、詳しい情報は専門文献を参照するよう促してください。`
        }
      ]
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

// Claudeレスポンスからテキストを抽出
function extractClaudeResponse(response) {
  if (!response.content) return '';
  
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  return text;
}

// メインハンドラー
exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };
  
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { query } = JSON.parse(event.body);
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '質問を入力してください' })
      };
    }
    
    // 1. J-STAGEで論文検索
    console.log('Searching J-STAGE...');
    let jstageResults = [];
    try {
      const jstageXml = await searchJstage(query);
      jstageResults = parseJstageResults(jstageXml);
      console.log(`Found ${jstageResults.length} articles`);
    } catch (e) {
      console.error('J-STAGE error:', e.message);
    }
    
    // 2. Claude APIで回答生成（Web検索含む）
    console.log('Calling Claude API...');
    const claudeResponse = await callClaude(query, jstageResults);
    
    if (claudeResponse.error) {
      throw new Error(claudeResponse.error.message || 'Claude API error');
    }
    
    const answer = extractClaudeResponse(claudeResponse);
    
    // 3. ソースリストを作成
    const sources = jstageResults.map(r => ({
      title: r.title,
      link: r.link,
      type: '📄 論文',
      meta: `${r.journal} ${r.year}年`
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer,
        sources,
        jstageCount: jstageResults.length
      })
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
