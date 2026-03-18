# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリ概要

100日チャレンジの学習プロジェクト集。日付ディレクトリ（`YYYYMMDD/`）ごとに独立したプロジェクトが格納されている。GitHub Pagesで公開。

## アーキテクチャ

- **ルート `index.html`**: 手動管理のプロジェクト一覧ページ（カード型UI、コメントモーダル付き）
- **`YYYYMMDD/`**: 各日のプロジェクト。`package.json`があればNode.jsプロジェクト、なければ静的HTML
- **`project.json`**: 各プロジェクトのメタデータ（title, description, tags）。`scripts/build-index.mjs`が参照する
- **`scripts/build-index.mjs`**: 日付ディレクトリを走査してindex.htmlを自動生成するスクリプト（現在は手動管理のindex.htmlと並存）

## デプロイ

GitHub Actions（`.github/workflows/deploy.yml`）がmainへのpushで自動デプロイ:
1. `package.json`のある日付ディレクトリは `npm ci && npm run build` でビルド
2. 静的ディレクトリはそのままコピー
3. ルートの`index.html`をコピー
4. `site/`ディレクトリをGitHub Pagesにデプロイ

## コマンド

```bash
# index.htmlの自動生成（project.jsonベース）
node scripts/build-index.mjs

# 各日付プロジェクトのビルド（例: 20260310）
cd 20260310 && npm ci && npm run build

# 各日付プロジェクトの開発サーバー（Viteベースの場合）
cd 20260310 && npm run dev
```

## 新しいプロジェクト追加時

1. `YYYYMMDD/` ディレクトリを作成
2. `project.json`にメタデータを記載（title, description, tags）
3. ルートの`index.html`にカードを追記（現在は手動管理）
4. コメントがある場合は`<template>`タグでMarkdownを埋め込み

## 注意事項

- APIキーは`.env`/`.env.local`で管理（`.gitignore`で除外済み）。BYOK方式でブラウザ側から入力可能にする設計
- `.env.example`のみコミット可
- `**/old/`と`**/ゴミ箱/`は`.gitignore`で除外
