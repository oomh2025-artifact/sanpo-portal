# 産業保健情報ポータル

産業保健に関する法令・ガイドライン・学術情報を集約したポータルサイトです。
**論文情報はJ-STAGE Web APIからリアルタイムで取得**されるため、常に最新の情報が表示されます。

## 機能

- **制度改正**: 産業保健関連の法令・ガイドライン改正情報
- **最新記事**: J-STAGEから**リアルタイム取得**した各学術誌の最新論文
- **雑誌一覧**: 無料で閲覧可能な産業保健関連学術誌の紹介

## セットアップ手順

### 1. GitHubリポジトリの作成

新しいリポジトリを作成し、以下のファイルをアップロード：

```
リポジトリ/
├── index.html
├── netlify.toml
└── netlify/
    └── functions/
        └── jstage.js
```

### 2. ファイルの配置

1. `index.html` → ルートに配置
2. `netlify.toml` → ルートに配置  
3. `jstage.js` → `netlify/functions/` フォルダを作成して配置

**フォルダの作り方（GitHub Web UI）:**
- 「Add file」→「Create new file」
- ファイル名に `netlify/functions/jstage.js` と入力するとフォルダが自動作成されます

### 3. Netlifyでデプロイ

1. [Netlify](https://netlify.com) にログイン
2. 「Add new site」→「Import an existing project」
3. GitHubリポジトリを選択
4. Build settings:
   - Build command: （空欄のまま）
   - Publish directory: `.`
5. 「Deploy site」をクリック

### 4. 完了

デプロイが完了すると、サイトにアクセスするたびにJ-STAGEから最新の論文情報が取得されます。

## 対象学術誌

| 雑誌名 | 発行元 |
|--------|--------|
| 産業衛生学雑誌 | 日本産業衛生学会 |
| Industrial Health | 労働安全衛生総合研究所 |
| 産業医学レビュー | 産業医学振興財団 |
| 産業精神保健 | 日本産業精神保健学会 |
| 日本産業看護学会誌 | 日本産業看護学会 |
| 産業保健法学会誌 | 日本産業保健法学会 |

## 技術仕様

- **フロントエンド**: 純粋なHTML/CSS/JavaScript（フレームワーク不使用）
- **バックエンド**: Netlify Functions（サーバーレス）
- **データソース**: J-STAGE Web API（https://api.jstage.jst.go.jp）

## ライセンス

MIT License

## 注意事項

- J-STAGE Web APIの利用規約に基づき、データはJSTより提供されたものです
- 大量アクセスは避けてください（APIの負荷軽減のため）
