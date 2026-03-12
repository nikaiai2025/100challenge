# 100challenge

日付フォルダ（`YYYYMMDD/`）ごとの成果物を GitHub Pages に公開するリポジトリです。

## デプロイ（GitHub Pages）
1. `main` へ push すると `.github/workflows/deploy.yml` が実行されます。
2. `YYYYMMDD/` 配下をビルドして `site/` に配置します。
3. ルート `index.html` は手動編集のため、そのまま `site/index.html` にコピーします。

## ルート index.html の運用（手動）
- ルート `index.html` は手動で編集します。
- 各日付カードには「コメント」ボタンがあります。
- コメント本文は `index.html` 内の `<template id="comment-YYYYMMDD">` に Markdown で書きます。
- モーダルで Markdown 表示されます（簡易レンダラー）。

## 日付フォルダの扱い
- `YYYYMMDD/` に `package.json` がある場合
  - `npm ci` と `npm run build` を実行して `site/YYYYMMDD/` に出力します。
- `package.json` がない場合
  - フォルダをそのまま `site/` にコピーします。

## ローカル確認
- 静的フォルダは `YYYYMMDD/index.html` を直接開いて確認できます。
- ビルドが必要なフォルダは `npm install` / `npm run build` を使ってください。
