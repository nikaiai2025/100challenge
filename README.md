# 100challenge

日付フォルダ（`YYYYMMDD/`）ごとのプロジェクトを GitHub Pages にデプロイするリポジトリです。

## デプロイ手順（GitHub Pages）

1. `main` ブランチへ push する  
   - `.github/workflows/deploy.yml` が起動します。
2. GitHub Actions の Deploy が完了するのを待つ
3. GitHub Pages から公開される

### 仕組み

- `YYYYMMDD/` に `package.json` がある場合  
  - `npm ci` → `npm run build` を実行し、`site/YYYYMMDD/` に出力
- `package.json` がない場合  
  - フォルダをそのまま `site/` にコピー（静的サイト）

`site/` に集約された内容が GitHub Pages に配信されます。

## ローカルでの確認

- 静的なフォルダはそのまま `YYYYMMDD/index.html` を開いて確認できます。
- ビルドが必要なプロジェクトは、それぞれのフォルダで `npm install` / `npm run build` を実行してください。
