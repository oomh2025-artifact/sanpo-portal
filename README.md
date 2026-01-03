# 労働衛生コンサルタント 口述試験対策システム

保健衛生区分の口述試験対策用チャットボットです。

## 🚀 デプロイ方法

### 1. GitHubリポジトリを作成
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. GitHub Pagesを有効化
1. リポジトリの **Settings** → **Pages**
2. **Source** で `main` ブランチを選択
3. フォルダは `/ (root)` を選択
4. **Save** をクリック

### 3. アクセス
数分後に `https://YOUR_USERNAME.github.io/YOUR_REPO/` でアクセスできます。

---

## 📁 ファイル構成

```
├── index.html          # アプリ本体
├── data/
│   ├── questions.md    # 予想問題集
│   └── followup.md     # 追加質問回答集
└── README.md
```

---

## 📝 問題の更新方法

### 問題を追加・編集する場合

`data/questions.md` を編集してpushするだけ！

```markdown
## テーマ名

**Q1（基本問題）：**
問題文をここに書く

**【模範解答】**
模範解答をここに書く

**【この問題で試験官が見ているポイント】**
- ポイント1
- ポイント2

**【想定される追加質問】**
- 追加質問1
- 追加質問2
```

### 追加質問の回答を追加する場合

`data/followup.md` を編集してpushするだけ！

```markdown
### Q：質問文

**A：** 回答文

---

### Q：次の質問

**A：** 次の回答
```

---

## 🎮 機能

- ✅ ランダム出題（5テーマ）
- ✅ AI採点（10点満点）
- ✅ 持ち帰り機能（2回まで）
- ✅ 復習フォルダ（5点以下を自動保存）
- ✅ 補足質問対応
- ✅ 合格判定（60%以上）

---

## ⚠️ 注意事項

- **Anthropic APIを使用**しています（採点機能）
- 復習フォルダはブラウザのlocalStorageに保存されます
- 別のブラウザ/デバイスではデータは共有されません

---

## 📱 スマホ対応

スマホのブラウザからもアクセス可能です。ホーム画面に追加すればアプリのように使えます。
