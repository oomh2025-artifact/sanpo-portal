// netlify/functions/jstage.js
// J-STAGE Web APIへのプロキシ

const JOURNALS = [
  { id: "sangyoeisei", name: "産業衛生学雑誌", publisher: "日本産業衛生学会", color: "#0066cc", issn: "1341-0725", cdjournal: "sangyoeisei" },
  { id: "indhealth", name: "Industrial Health", publisher: "労働安全衛生総合研究所", color: "#006644", issn: "0019-8366", cdjournal: "indhealth" },
  { id: "ohpfrev", name: "産業医学レビュー", publisher: "産業医学振興財団", color: "#cc3300", issn: "1882-5826", cdjournal: "ohpfrev" },
  { id: "jjomh", name: "産業精神保健", publisher: "日本産業精神保健学会", color: "#9933cc", issn: "1340-2862", cdjournal: "jjomh" },
  { id: "jaohn", name: "日本産業看護学会誌", publisher: "日本産業看護学会", color: "#e91e63", issn: "2187-2899", cdjournal: "jaohn" },
  { id: "jaohl", name: "産業保健法学会誌", publisher: "日本産業保健法学会", color: "#336699", issn: "2758-5069", cdjournal: "jaohl" },
];

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const results = [];

    for (const journal of JOURNALS) {
      try {
        // J-STAGE API: service=3 で論文検索、cdjournal で雑誌指定、count=5 で最新5件
        const apiUrl = `https://api.jstage.jst.go.jp/searchapi/do?service=3&cdjournal=${journal.cdjournal}&count=5`;
        
        const response = await fetch(apiUrl);
        const xmlText = await response.text();
        
        // XMLをパース
        const articles = parseArticlesFromXml(xmlText);
        const latestIssue = extractLatestIssue(xmlText);

        results.push({
          id: journal.id,
          name: journal.name,
          publisher: journal.publisher,
          color: journal.color,
          url: `https://www.jstage.jst.go.jp/browse/${journal.cdjournal}/-char/ja`,
          latest_issue: latestIssue,
          articles: articles.slice(0, 3),
        });
      } catch (err) {
        console.error(`Error fetching ${journal.name}:`, err);
        results.push({
          id: journal.id,
          name: journal.name,
          publisher: journal.publisher,
          color: journal.color,
          url: `https://www.jstage.jst.go.jp/browse/${journal.cdjournal}/-char/ja`,
          latest_issue: "",
          articles: [],
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        updated_at: new Date().toISOString().split("T")[0],
        journals: results,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

function parseArticlesFromXml(xml) {
  const articles = [];
  // <entry>...</entry> を抽出
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    // タイトル（日本語優先）
    let title = extractTag(entry, "article_title") || extractTag(entry, "title") || "";
    
    // 著者
    let authors = extractTag(entry, "creator") || "";
    if (authors.length > 40) {
      const authorList = authors.split(/[,、，]/);
      authors = authorList.length > 1 ? authorList[0].trim() + " 他" : authors.slice(0, 40) + "...";
    }

    // リンク
    const link = extractAttr(entry, "link", "href") || "";

    if (title) {
      articles.push({ title, authors, link });
    }
  }

  return articles;
}

function extractLatestIssue(xml) {
  const vol = extractTag(xml, "prism:volume") || extractTag(xml, "volume");
  const no = extractTag(xml, "prism:number") || extractTag(xml, "number");
  const year = extractTag(xml, "prism:publicationDate") || extractTag(xml, "pubyear");
  
  if (vol && no) {
    const y = year ? year.slice(0, 4) + "年 " : "";
    return `${y}${vol}巻${no}号`;
  }
  return "";
}

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/<[^>]+>/g, "") : "";
}

function extractAttr(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}
