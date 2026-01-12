#!/usr/bin/env python3
import json
import re
import urllib.request
from datetime import datetime

# RSSフィード
RSS_FEEDS = [
    {"name": "厚生労働省 新着情報", "url": "https://www.mhlw.go.jp/stf/news.rdf"},
]

# 産業保健関連キーワード（これらを含む記事を抽出）
KEYWORDS = [
    "安全衛生", "労働安全", "労働衛生", "産業保健", "産業医", "健康診断",
    "ストレスチェック", "メンタルヘルス", "過重労働", "長時間労働",
    "労災", "労働災害", "職業病", "化学物質", "有害物質", "じん肺",
    "健康経営", "治療と仕事", "両立支援", "テレワーク", "在宅勤務",
    "感染症", "熱中症", "腰痛", "VDT", "受動喫煙", "禁煙",
    "作業環境", "保護具", "安全管理", "衛生管理", "衛生委員会",
    "特殊健康診断", "一般健康診断", "定期健康診断",
    "労働基準", "36協定", "働き方改革",
]

JOURNALS = [
    {"id": "sangyoeisei", "name": "産業衛生学雑誌", "publisher": "日本産業衛生学会",
     "url": "https://www.jstage.jst.go.jp/browse/sangyoeisei/-char/ja",
     "desc": "産業保健・労働衛生分野の原著論文、総説、症例報告などを掲載。国内最大の産業保健専門誌。"},
    {"id": "indhealth", "name": "Industrial Health", "publisher": "労働安全衛生総合研究所",
     "url": "https://www.jstage.jst.go.jp/browse/indhealth/-char/ja",
     "desc": "世界各国の産業保健研究を掲載する国際英文誌。オープンアクセス。"},
    {"id": "ohpfrev", "name": "産業医学レビュー", "publisher": "産業医学振興財団",
     "url": "https://www.jstage.jst.go.jp/browse/ohpfrev/-char/ja",
     "desc": "産業医・産業保健専門職向けの実務に役立つ総説・解説誌。"},
    {"id": "jjomh", "name": "産業精神保健", "publisher": "日本産業精神保健学会",
     "url": "https://www.jstage.jst.go.jp/browse/jjomh/-char/ja",
     "desc": "職場のメンタルヘルスに特化。ストレスチェック、復職支援などを掲載。"},
    {"id": "jaohn", "name": "日本産業看護学会誌", "publisher": "日本産業看護学会",
     "url": "https://www.jstage.jst.go.jp/browse/jaohn/-char/ja",
     "desc": "産業看護職の実践と研究に関する論文を掲載。"},
    {"id": "jaohl", "name": "産業保健法学会誌", "publisher": "日本産業保健法学会",
     "url": "https://www.jstage.jst.go.jp/browse/jaohl/-char/ja",
     "desc": "産業保健と法律の接点を扱う専門誌。労働安全衛生法、労災認定など。"},
]

API_URL = "https://api.jstage.jst.go.jp/searchapi/do"

def fetch_journal(journal_id, count=5):
  from datetime import datetime
year = datetime.now().year - 1
url = f"{API_URL}?service=3&cdjournal={journal_id}&count={count}&pubyearfrom={year}&sortflg=2"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            xml = resp.read().decode("utf-8")
        return parse_xml(xml)
    except Exception as e:
        print(f"  Error fetching {journal_id}: {e}")
        return []

def parse_xml(xml):
    articles = []
    entries = xml.split("<entry>")
    
    for entry in entries[1:]:
        entry = entry.split("</entry>")[0]
        
        # タイトル
        title = ""
        m = re.search(r'article_title[\s\S]*?<ja>[\s\S]*?CDATA\[([\s\S]*?)\]\]', entry)
        if m:
            title = m.group(1).strip()
        if not title:
            m = re.search(r'article_title[\s\S]*?<en>[\s\S]*?CDATA\[([\s\S]*?)\]\]', entry)
            if m:
                title = m.group(1).strip()
        if not title:
            m = re.search(r'<title>[\s\S]*?CDATA\[([\s\S]*?)\]\]', entry)
            if m and not m.group(1).startswith("http"):
                title = m.group(1).strip()
        
        if not title:
            continue
        
        # 著者
        authors = []
        author_match = re.search(r'<author>([\s\S]*?)</author>', entry)
        if author_match:
            author_block = author_match.group(1)
            ja_block = re.search(r'<ja>([\s\S]*?)</ja>', author_block)
            if ja_block:
                names = re.findall(r'CDATA\[([\s\S]*?)\]\]', ja_block.group(1))
                authors = [n.strip() for n in names if n.strip()]
            else:
                en_block = re.search(r'<en>([\s\S]*?)</en>', author_block)
                if en_block:
                    names = re.findall(r'CDATA\[([\s\S]*?)\]\]', en_block.group(1))
                    authors = [n.strip() for n in names if n.strip()]
        
        # 巻号年
        vol = re.search(r'volume>(\d+)<', entry)
        num = re.search(r'number>([^<]+)<', entry)
        year = re.search(r'pubyear>(\d+)<', entry)
        link = re.search(r'link[^>]*href="([^"]+)"', entry)
        
        articles.append({
            "title": title,
            "authors": authors[:5],
            "volume": vol.group(1) if vol else "",
            "number": num.group(1) if num else "",
            "year": year.group(1) if year else "",
            "link": link.group(1) if link else "",
        })
    
    return articles[:5]

def fetch_rss():
    """厚労省RSSから産業保健関連ニュースを取得"""
    news = []
    
    for feed in RSS_FEEDS:
        try:
            req = urllib.request.Request(feed["url"], headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                xml = resp.read().decode("utf-8")
            
            # RSSアイテムを抽出
            items = re.findall(r'<item>([\s\S]*?)</item>', xml)
            
            for item in items[:50]:  # 最新50件をチェック
                title_m = re.search(r'<title>([^<]+)</title>', item)
                link_m = re.search(r'<link>([^<]+)</link>', item)
                date_m = re.search(r'<dc:date>([^<]+)</dc:date>', item)
                
                if not title_m:
                    continue
                
                title = title_m.group(1).strip()
                
                # キーワードフィルタ
                if not any(kw in title for kw in KEYWORDS):
                    continue
                
                link = link_m.group(1).strip() if link_m else ""
                date_str = ""
                if date_m:
                    try:
                        dt = datetime.fromisoformat(date_m.group(1).replace("+09:00", ""))
                        date_str = dt.strftime("%Y-%m-%d")
                    except:
                        date_str = date_m.group(1)[:10]
                
                news.append({
                    "title": title,
                    "link": link,
                    "date": date_str,
                    "source": feed["name"]
                })
        
        except Exception as e:
            print(f"  Error fetching RSS {feed['name']}: {e}")
    
    # 日付でソート、最新10件
    news.sort(key=lambda x: x.get("date", ""), reverse=True)
    return news[:10]

def main():
    print("J-STAGEから論文データを取得中...")
    
    data = {
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "journals": [],
        "news": []
    }
    
    for j in JOURNALS:
        print(f"  {j['name']}...")
        articles = fetch_journal(j["id"])
        print(f"    -> {len(articles)}件")
        data["journals"].append({**j, "articles": articles})
    
    print("厚労省RSSから新着情報を取得中...")
    data["news"] = fetch_rss()
    print(f"    -> {len(data['news'])}件")
    
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n保存: data.json")

if __name__ == "__main__":
    main()
