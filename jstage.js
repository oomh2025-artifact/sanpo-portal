// netlify/functions/jstage.js
// J-STAGE Web APIへのプロキシ（並列処理・タイムアウト対応）

const JOURNALS = [
  { id: "sangyoeisei", name: "産業衛生学雑誌", publisher: "日本産業衛生学会", color: "#0066cc", cdjournal: "sangyoeisei" },
  { id: "indhealth", name: "Industrial Health", publisher: "労働安全衛生総合研究所", color: "#006644", cdjournal: "indhealth" },
  { id: "ohpfrev", name: "産業医学レビュー", publisher: "産業医学振興財団", color: "#cc3300", cdjournal: "ohpfrev" },
  { id: "jjomh", name: "産業精神保健", publisher: "日本産業精神保健学会", color: "#9933cc", cdjournal: "jjomh" },
  { id: "jaohn", name: "日本産業看護学会誌", publisher: "日本産業看護学会", color: "#e91e63", cdjournal: "jaohn" },
  { id: "jaohl", name: "産業保健法学会誌", publisher: "日本産業保健法学会", color: "#336699", cdjournal: "jaohl" },
];

// タイムアウト付きfetch
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 単一雑誌のデータ取得
async function fetchJournalData(journal) {
  try {
    const apiUrl = `https://api.jstage.jst.go.jp/searchapi/do?service=3&cdjournal=${journal.cdjournal}&count=5`;
    const response = await fetchWithTimeout(apiUrl, 4000);
    const xmlText = await response.text();
    
    const articles = parseArticlesFromXml(xmlText);
    const latestIssue = extractLatestIssue(xmlText);

    return {
      id: journal.id,
      name: journal.name,
      publisher: journal.publisher,
      color: journal.color,
      url: `https://www.jstage.jst.go.jp/browse/${journal.cdjournal}/-char/ja`,
      latest_issue: latestIssue,
      articles: articles.slice(0, 3),
    };
  } catch (err) {
    console.error(`Error fetching ${journal.name}:`, err.message);
    return {
      id: journal.id,
      name: journal.name,
      publisher: journal.publisher,
      color: journal.color,
      url: `https://www.jstage.jst.go.jp/browse/${journal.cdjournal}/-char/ja`,
      latest_issue: "",
      articles: [],
    };
  }
}

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600", // 1時間キャッシュ
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // 全雑誌を並列で取得（大幅に高速化）
    const results = await Promise.all(JOURNALS.map(j => fetchJournalData(j)));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        updated_at: new Date().toISOString().split("T")[0],
        journals: results,
      }),
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

function parseArticlesFromXml(xml) {
  const articles = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null && articles.length < 5) {
    const entry = match[1];

    // タイトル（日本語優先）
    let title = extractTag(entry, "article_title") || extractTag(entry, "title") || "";
    title = title.replace(/<[^>]+>/g, "").trim(); // HTMLタグ除去
    
    // 著者
    let authors = extractTag(entry, "creator") || "";
    authors = authors.replace(/<[^>]+>/g, "").trim();
    if (authors.length > 40) {
      const authorList = authors.split(/[,、，\n]/);
      authors = authorList.length > 1 ? authorList[0].trim() + " 他" : authors.slice(0, 40) + "...";
    }

    // リンク
    const link = extractAttr(entry, "link", "href") || "";

    if (title && title.length > 3) {
      articles.push({ title: title.slice(0, 100), authors, link });
    }
  }

  return articles;
}

function extractLatestIssue(xml) {
  // 最初のエントリーから巻号情報を取得
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return "";
  
  const entry = entryMatch[1];
  const vol = extractTag(entry, "prism:volume") || extractTag(entry, "volume") || "";
  const no = extractTag(entry, "prism:number") || extractTag(entry, "number") || "";
  const year = extractTag(entry, "pubyear") || "";
  
  if (vol) {
    let issue = "";
    if (year) issue += year + "年 ";
    issue += vol + "巻";
    if (no) issue += no + "号";
    return issue;
  }
  return "";
}

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractAttr(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}
