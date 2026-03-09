exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  const q = event.queryStringParameters?.q;
  if (!q) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing query parameter: q' }) };
  }

  const url = `https://api.jstage.jst.go.jp/searchapi/do?service=3&keyword=${encodeURIComponent(q)}&count=10`;

  try {
    const res = await fetch(url);
    const xml = await res.text();

    const results = [];
    const entries = xml.split('<entry>').slice(1);

    for (const entry of entries) {
      const title =
        entry.match(/<article_title[^>]*xml:lang="ja"[^>]*>([\s\S]*?)<\/article_title>/)?.[1]?.trim() ||
        entry.match(/<article_title[^>]*>([\s\S]*?)<\/article_title>/)?.[1]?.trim() || '';
      const link =
        entry.match(/<article_link[^>]*xml:lang="ja"[^>]*>([\s\S]*?)<\/article_link>/)?.[1]?.trim() ||
        entry.match(/<article_link[^>]*>([\s\S]*?)<\/article_link>/)?.[1]?.trim() || '';
      const journal =
        entry.match(/<material_title[^>]*xml:lang="ja"[^>]*>([\s\S]*?)<\/material_title>/)?.[1]?.trim() ||
        entry.match(/<material_title[^>]*>([\s\S]*?)<\/material_title>/)?.[1]?.trim() || '';
      const volume = entry.match(/<volume>([\s\S]*?)<\/volume>/)?.[1]?.trim() || '';
      const year = entry.match(/<pubyear>([\s\S]*?)<\/pubyear>/)?.[1]?.trim() || '';

      if (title) results.push({ title, link, journal, volume, year });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ results }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
