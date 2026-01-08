#!/usr/bin/env python3
import json
import re
import urllib.request
from datetime import datetime

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
    url = f"{API_URL}?service=3&cdjournal={journal_id}&count={count}&pubyearfrom=2023"
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
        # まず<title>タグから取得（最も確実）
        m = re.search(r'<title><!\[CDATA\[([\s\S]*?)\]\]></title>', entry)
        if m and not m.group(1).startswith("http"):
            title = m.group(1).strip()
        # 日本語タイトルがあれば優先
        if not title:
            m = re.search(r'article_title[\s\S]*?<ja><!\[CDATA\[([\s\S]*?)\]\]></ja>', entry)
            if m:
                title = m.group(1).strip()
        # 英語タイトル
        if not title:
            m = re.search(r'article_title[\s\S]*?<en><!\[CDATA\[([\s\S]*?)\]\]></en>', entry)
            if m:
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

def main():
    print("J-STAGEから論文データを取得中...")
    
    data = {
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "journals": []
    }
    
    for j in JOURNALS:
        print(f"  {j['name']}...")
        articles = fetch_journal(j["id"])
        print(f"    -> {len(articles)}件")
        data["journals"].append({**j, "articles": articles})
    
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n保存: data.json")

if __name__ == "__main__":
    main()
