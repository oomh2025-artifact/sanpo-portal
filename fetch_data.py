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

def extract_cdata(text):
    """CDATAの中身を抽出"""
    m = re.search(r'<!\[CDATA\[([\s\S]*?)\]\]>', text)
    return m.group(1).strip() if m else text.strip()

def parse_xml(xml):
    articles = []
    entries = xml.split("<entry>")
    
    for entry in entries[1:]:
        entry = entry.split("</entry>")[0]
        
        # タイトル取得（article_titleを優先）
        title = ""
        
        # 1. article_title内の日本語タイトル
        m = re.search(r'<article_title[^>]*>([\s\S]*?)</article_title>', entry)
        if m:
            article_title_block = m.group(1)
            # 日本語タイトル
            ja_m = re.search(r'<ja>([\s\S]*?)</ja>', article_title_block)
            if ja_m:
                title = extract_cdata(ja_m.group(1))
            # 英語タイトル（日本語がない場合）
            if not title:
                en_m = re.search(r'<en>([\s\S]*?)</en>', article_title_block)
                if en_m:
                    title = extract_cdata(en_m.group(1))
        
        # 2. article_titleがない場合、titleタグから（URLでないもの）
        if not title:
            for m in re.finditer(r'<title[^>]*>([\s\S]*?)</title>', entry):
                candidate = extract_cdata(m.group(1))
                if candidate and not candidate.startswith("http"):
                    title = candidate
                    break
        
        if not title:
            continue
        
        # 著者取得
        authors = []
        author_match = re.search(r'<author>([\s\S]*?)</author>', entry)
        if author_match:
            author_block = author_match.group(1)
            # 日本語著者名を優先
            ja_block = re.search(r'<ja>([\s\S]*?)</ja>', author_block)
            if ja_block:
                names = re.findall(r'<!\[CDATA\[([\s\S]*?)\]\]>', ja_block.group(1))
                authors = [n.strip() for n in names if n.strip()]
            # 英語著者名
            if not authors:
                en_block = re.search(r'<en>([\s\S]*?)</en>', author_block)
                if en_block:
                    names = re.findall(r'<!\[CDATA\[([\s\S]*?)\]\]>', en_block.group(1))
                    authors = [n.strip() for n in names if n.strip()]
        
        # 巻号年
        vol = re.search(r'<prism:volume>(\d+)</prism:volume>', entry)
        num = re.search(r'<prism:number>([^<]+)</prism:number>', entry)
        year = re.search(r'<pubyear>(\d+)</pubyear>', entry)
        link = re.search(r'<link[^>]*href="([^"]+)"', entry)
        
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
