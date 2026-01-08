# 産業保健情報ポータル

産業医・産業保健スタッフ向けの情報ポータルサイト

## 機能

1. **最新論文** - J-STAGE APIから6誌の最新論文を自動取得
2. **制度・法令** - 厚労省等の関連サイトへのリンク集
3. **雑誌一覧** - 産業保健関連学術誌の一覧

## セットアップ

### 1. GitHubリポジトリ作成

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sanpo-portal.git
git push -u origin main
```

### 2. GitHub Pages有効化

1. リポジトリの **Settings** → **Pages** を開く
2. **Source** で「GitHub Actions」を選択
3. 保存

### 3. 初回ビルド

1. **Actions** タブを開く
2. 「Build and Deploy」ワークフローを選択
3. 「Run workflow」ボタンをクリック

## 更新スケジュール

- **自動更新**: 毎週月曜 9:00 (JST)
- **手動更新**: Actions → Run workflow

## ローカルテスト

```bash
python scripts/fetch_articles.py
python scripts/build_html.py
# index.html をブラウザで開く
```

## ファイル構成

```
├── .github/workflows/build.yml  # GitHub Actions
├── scripts/
│   ├── fetch_articles.py        # J-STAGE API取得
│   └── build_html.py            # HTML生成
├── data.json                    # 取得データ（自動生成）
├── index.html                   # サイト本体（自動生成）
└── README.md
```

## 対象雑誌

| 雑誌名 | 発行元 |
|--------|--------|
| 産業衛生学雑誌 | 日本産業衛生学会 |
| Industrial Health | 労働安全衛生総合研究所 |
| 産業医学レビュー | 産業医学振興財団 |
| 産業精神保健 | 日本産業精神保健学会 |
| 日本産業看護学会誌 | 日本産業看護学会 |
| 産業保健法学会誌 | 日本産業保健法学会 |
