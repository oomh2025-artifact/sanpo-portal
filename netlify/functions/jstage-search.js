// Netlify Function: J-STAGE API プロキシ
// CORSの問題を回避するためのサーバーサイドプロキシ

exports.handler = async function(event, context) {
  // CORSヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONSリクエスト（プリフライト）への対応
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    
    // 必須パラメータのチェック
    if (!params.keyword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'keyword parameter is required' })
      };
    }

    const journals = params.journals ? params.journals.split(',') : [
      'sangyoeisei', 'indhealth', 'ohpfrev', 'jjomh', 'jaohn', 'jaohl'
    ];

    const allResults = [];

    // 各雑誌からデータを取得
    for (const journal of journals) {
      const searchParams = new URLSearchParams({
        service: '3',
        cdjournal: journal,
        text: params.keyword,
        count: '100'
      });

      if (params.yearFrom) searchParams.append('pubyearfrom', params.yearFrom);
      if (params.yearTo) searchParams.append('pubyearto', params.yearTo);

      const apiUrl = `https://api.jstage.jst.go.jp/searchapi/do?${searchParams}`;

      try {
        const response = await fetch(apiUrl);
        const xmlText = await response.text();
        
        // XMLをパースして結果を抽出
        const results = parseJstageXml(xmlText, journal);
        allResults.push(...results);
      } catch (err) {
        console.error(`Error fetching ${journal}:`, err);
      }
    }

    // 年度で降順ソート
    allResults.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: allResults.length,
        results: allResults
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// XMLパース関数（シンプルな正規表現ベース）
function parseJstageXml(xmlText, journalCode) {
  const results = [];
  
  // エラーチェック
  const statusMatch = xmlText.match(/<status>(\d+)<\/status>/);
  if (statusMatch && statusMatch[1] !== '0') {
    return results;
  }

  // entry要素を抽出
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    const entry = entryMatch[1];

    // タイトル（日本語優先）
    const titleJaMatch = entry.match(/<article_title>[\s\S]*?<ja><!\[CDATA\[(.*?)\]\]><\/ja>/);
    const titleEnMatch = entry.match(/<article_title>[\s\S]*?<en><!\[CDATA\[(.*?)\]\]><\/en>/);
    const title = (titleJaMatch && titleJaMatch[1]) || (titleEnMatch && titleEnMatch[1]) || '';

    // リンク
    const linkJaMatch = entry.match(/<article_link>[\s\S]*?<ja>(.*?)<\/ja>/);
    const linkEnMatch = entry.match(/<article_link>[\s\S]*?<en>(.*?)<\/en>/);
    const link = (linkJaMatch && linkJaMatch[1]) || (linkEnMatch && linkEnMatch[1]) || '';

    // 著者名
    const authors = [];
    const authorJaRegex = /<author>[\s\S]*?<ja>([\s\S]*?)<\/ja>/;
    const authorJaMatch = entry.match(authorJaRegex);
    if (authorJaMatch) {
      const nameRegex = /<n><!\[CDATA\[(.*?)\]\]><\/n>/g;
      let nameMatch;
      while ((nameMatch = nameRegex.exec(authorJaMatch[1])) !== null) {
        authors.push(nameMatch[1]);
      }
    }

    // 雑誌名
    const materialJaMatch = entry.match(/<material_title>[\s\S]*?<ja><!\[CDATA\[(.*?)\]\]><\/ja>/);
    const materialEnMatch = entry.match(/<material_title>[\s\S]*?<en><!\[CDATA\[(.*?)\]\]><\/en>/);
    const journal = (materialJaMatch && materialJaMatch[1]) || (materialEnMatch && materialEnMatch[1]) || '';

    // 巻号・年
    const volumeMatch = entry.match(/<prism:volume>(.*?)<\/prism:volume>/);
    const numberMatch = entry.match(/<prism:number>(.*?)<\/prism:number>/);
    const yearMatch = entry.match(/<pubyear>(.*?)<\/pubyear>/);

    if (title) {
      results.push({
        title,
        link,
        authors,
        journal,
        journalCode,
        volume: volumeMatch ? volumeMatch[1] : '',
        number: numberMatch ? numberMatch[1] : '',
        year: yearMatch ? yearMatch[1] : ''
      });
    }
  }

  return results;
}
