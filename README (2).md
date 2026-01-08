# 産業保健情報ポータル

J-STAGE APIから産業保健関連の学術誌の最新記事を取得して表示します。

## ファイル構成

```
リポジトリ/
├── index.html          ← ルートに配置
├── netlify.toml        ← ルートに配置
└── netlify/
    └── functions/
        └── jstage.js   ← この場所に配置
```

## デプロイ手順

1. GitHubに新しいリポジトリを作成

2. 以下のファイルをアップロード:
   - `index.html` → リポジトリのルート
   - `netlify.toml` → リポジトリのルート
   - `jstage.js` → `netlify/functions/` フォルダを作成してその中に

3. Netlifyでデプロイ:
   - Netlifyにログイン
   - "Add new site" → "Import an existing project"
   - GitHubリポジトリを選択
   - デプロイ設定はそのままでOK（netlify.tomlが自動認識される）

4. デプロイ完了後、サイトURLにアクセス

## 動作確認

- ページを開くとNetlify FunctionがJ-STAGE APIを呼び出し
- 各学術誌の最新記事（タイトル・著者）が表示される
- データは30分キャッシュされる

## トラブルシューティング

Netlify管理画面 → Functions → jstage → Logs でエラーを確認できます。
