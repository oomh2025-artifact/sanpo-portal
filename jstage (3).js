const https = require('https');

const JOURNALS = [
  { id: 'sangyoeisei', name: '産業衛生学雑誌', color: '#0066cc' },
  { id: 'indhealth', name: 'Industrial Health', color: '#006644' },
  { id: 'ohpfrev', name: '産業医学レビュー', color: '#cc3300' },
  { id: 'jjomh', name: '産業精神保健', color: '#9933cc' },
  { id: 'jaohn', name: '日本産業看護学会誌', color: '#e91e63' },
  { id: 'jaohl', name: '産業保健法学会誌', color: '#336699' },
];

function fetchXML(cdjournal) {
  return new Promise((resolve, reject) => {
    const year = new Date().getFullYear();
    const url = `https://api.jstage.jst.go.jp/searchapi/do?service=3&cdjournal=${cdjournal}&count=10&sortflg=2&pubyearfrom=${year - 1}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractText(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
}

function parseArticles(xml) {
  const articles = [];
  const entries = xml.split('<entry>').slice(1);
  
  let latestIssue = '';
  
  for (let i = 0; i < entries.length && articles.length < 3; i++) {
    const entry = entries[i];
    
    // 巻号（最初のエントリから取得）
    if (i === 0) {
      const vol = extractText(entry, 'prism:volume');
      const no = extractText(entry, 'prism:number');
      const year = extractText(entry, 'pubyear');
      if (vol) {
        latestIssue = (year ? year + '年 ' : '') + vol + '巻' + (no ? no + '号' : '');
      }
    }
    
    // タイトル
    let title = '';
    const articleTitleMatch = entry.match(/<article_title>([\s\S]*?)<\/article_title>/i);
    if (articleTitleMatch) {
      const block = articleTitleMatch[1];
      const jaMatch = block.match(/<ja>([\s\S]*?)<\/ja>/i);
      const enMatch = block.match(/<en>([\s\S]*?)<\/en>/i);
      if (jaMatch) title = jaMatch[1];
      else if (enMatch) title = enMatch[1];
    }
    if (!title) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i);
      if (titleMatch && !titleMatch[1].includes('http')) {
        title = titleMatch[1];
      }
    }
    title = title.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
    
    // 著者
    let authors = '';
    const authorMatch = entry.match(/<author>([\s\S]*?)<\/author>/i);
    if (authorMatch) {
      const block = authorMatch[1];
      const jaMatch = block.match(/<ja>([\s\S]*?)<\/ja>/i);
      const enMatch = block.match(/<en>([\s\S]*?)<\/en>/i);
      const src = jaMatch ? jaMatch[1] : (enMatch ? enMatch[1] : block);
      
      const names = [];
      const nRe = /<n>([\s\S]*?)<\/n>/gi;
      let m;
      while ((m = nRe.exec(src)) !== null) {
        const name = m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
        if (name) names.push(name);
      }
      if (names.length > 2) authors = names[0] + ' 他';
      else if (names.length > 0) authors = names.join(', ');
    }
    
    if (title && title.length > 3) {
      articles.push({ title: title.slice(0, 100), authors });
    }
  }
  
  return { articles, latestIssue };
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=1800'
  };
  
  try {
    const results = await Promise.all(
      JOURNALS.map(async (j) => {
        try {
          const xml = await fetchXML(j.id);
          const { articles, latestIssue } = parseArticles(xml);
          return {
            id: j.id,
            name: j.name,
            color: j.color,
            url: `https://www.jstage.jst.go.jp/browse/${j.id}/-char/ja`,
            latest_issue: latestIssue,
            articles
          };
        } catch (e) {
          return {
            id: j.id,
            name: j.name,
            color: j.color,
            url: `https://www.jstage.jst.go.jp/browse/${j.id}/-char/ja`,
            latest_issue: '',
            articles: []
          };
        }
      })
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        updated_at: new Date().toISOString().split('T')[0],
        journals: results
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
