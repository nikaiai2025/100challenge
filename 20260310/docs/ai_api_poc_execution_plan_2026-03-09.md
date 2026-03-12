# BattleBoard AI API 無料枠PoC 実行計画書（最小疎通確認）

作成日: 2026-03-09（JST）  
対象: ローカルPC上の導入済み `python`

## 1. 目的

- 無料利用可能なAI APIを対象に、最小構成で疎通確認を行う。
- 各モデルのAPIを順に1回ずつ実行し、結果を `print()` で確認する。
- 環境構築やアプリ組み込みは行わず、単体スクリプトだけで確認する。

## 2. ゴール定義

- ゴール1: 対象APIを順番に呼び出せること。
- ゴール2: 1つ以上のAPIで期待する応答が取得できること。
- ゴール3: 成功/失敗をコンソール出力で確認できること。

## 3. 対象API（無料利用可能枠）

以下を対象として順次試行する。

1. Gemini Free Tier
2. Groq Free Tier
3. OpenRouter Free
4. Mistral Experiment
5. Cohere Trial
6. Hugging Face Inference Providers（無料クレジット）
7. GitHub Models（無料・rate-limited）
8. Cerebras Free Tier
9. SambaNova（初期無料クレジット）
10. Fireworks（新規無料クレジット）

## 4. 人間が事前に用意するもの

## 4.1 APIキー・トークン

下記サービスでAPIキーまたはトークンを発行しておく。  
最初は2〜3サービスだけで開始してよい。

1. `GOOGLE_GENERATIVE_AI_API_KEY`
2. `GROQ_API_KEY`
3. `OPENROUTER_API_KEY`
4. `MISTRAL_API_KEY`
5. `COHERE_API_KEY`
6. `HF_TOKEN`
7. `GITHUB_MODELS_TOKEN`
8. `CEREBRAS_API_KEY`
9. `SAMBANOVA_API_KEY`
10. `FIREWORKS_API_KEY`

## 4.2 実行前提

1. `python` は導入済みであること
2. 必要な認証情報は環境変数で参照できる状態にしておくこと
3. 追加の環境構築は行わないこと

環境変数設定例:

```powershell
$env:GOOGLE_GENERATIVE_AI_API_KEY="..."
$env:GROQ_API_KEY="..."
$env:OPENROUTER_API_KEY="..."
$env:MISTRAL_API_KEY="..."
$env:COHERE_API_KEY="..."
$env:HF_TOKEN="..."
$env:GITHUB_MODELS_TOKEN="..."
$env:CEREBRAS_API_KEY="..."
$env:SAMBANOVA_API_KEY="..."
$env:FIREWORKS_API_KEY="..."
```

## 4.3 注意事項

1. 無料枠はレート制限があるため、短時間に連続再実行しすぎない
2. 一部サービスは無料クレジット失効や利用条件変更の可能性がある
3. APIキー自体は `print()` しない

## 4.4 人間が行うべき環境準備の手順

このPoCではアプリ環境構築は不要だが、各APIを呼ぶ前に人間が認証情報を取得し、ローカル環境変数へ設定する必要がある。  
最初は `Gemini` / `Groq` / `OpenRouter` の3つ程度から始めるのがよい。

## 4.4.1 共通手順

1. 導入済み `python` が実行できることを確認する
2. このディレクトリにある `.env.local.example` を参考に `.env.local` を作成する
3. 利用したいサービスのAPIキーだけを `.env.local` に設定する
4. APIキーはGitに含めない。`.gitignore` で `.env.local` が除外されていることを確認する
5. 1サービスずつ設定し、設定直後に `python .\ai_api_poc.py --providers <provider>` で疎通確認する

## 4.4.2 サービス別手順

### Gemini

1. Google AI StudioでAPIキーを発行する
2. Free Tierのレート制限を確認する
3. `.env.local` に `GOOGLE_GENERATIVE_AI_API_KEY` を設定する
4. 必要なら `GEMINI_MODEL` を設定する

### Groq

1. Groq Consoleでアカウントを作成する
2. APIキーを発行する
3. Free Tierの上限を確認する
4. `.env.local` に `GROQ_API_KEY` を設定する
5. 必要なら `GROQ_MODEL` を設定する

### OpenRouter

1. OpenRouterでAPIキーを発行する
2. 無料プランのリクエスト上限を確認する
3. `.env.local` に `OPENROUTER_API_KEY` を設定する
4. 必要なら `OPENROUTER_MODEL` を設定する
5. 必要に応じて `OPENROUTER_SITE_URL` と `OPENROUTER_APP_NAME` を設定する

### Mistral

1. Mistralアカウントを作成する
2. 無料Experimentプランを使う場合は条件を確認する
3. 必要であれば電話番号認証を完了する
4. APIキーを発行する
5. `.env.local` に `MISTRAL_API_KEY` を設定する
6. 必要なら `MISTRAL_MODEL` を設定する

### Cohere

1. Cohere DashboardでAPIキーを作成する
2. Trial key と Production key の違いを確認する
3. Trialの制限を確認する
4. `.env.local` に `COHERE_API_KEY` を設定する
5. 必要なら `COHERE_MODEL` を設定する

### Hugging Face Inference Providers

1. Hugging Faceアカウントを作成する
2. Fine-grained token を作成する
3. Inference Providers 用の権限を確認する
4. 無料クレジット枠と超過時の扱いを確認する
5. `.env.local` に `HF_TOKEN` を設定する
6. 必要なら `HF_MODEL` を設定する

### GitHub Models

1. GitHub Models を有効化する
2. Fine-grained PAT または GitHub App を作成する
3. `models:read` 権限を付与する
4. 無料の rate limit と有料 opt-in 条件を確認する
5. `.env.local` に `GITHUB_MODELS_TOKEN` を設定する
6. 必要なら `GITHUB_MODELS_MODEL` を設定する

### Cerebras

1. Cerebrasアカウントを作成する
2. APIキーを発行する
3. Free Tierのレート制限を確認する
4. `.env.local` に `CEREBRAS_API_KEY` を設定する
5. 必要なら `CEREBRAS_MODEL` を設定する

### SambaNova

1. SambaNova Cloudアカウントを作成する
2. APIキーを発行する
3. 初期無料クレジットの金額と失効期限を確認する
4. `.env.local` に `SAMBANOVA_API_KEY` を設定する
5. 必要なら `SAMBANOVA_MODEL` を設定する

### Fireworks

1. Fireworksアカウントを作成する
2. APIキーを発行する
3. 新規無料クレジットの有無と期限を確認する
4. `.env.local` に `FIREWORKS_API_KEY` を設定する
5. 必要なら `FIREWORKS_MODEL` を設定する

## 4.4.3 `.env.local` 設定手順

1. `.env.local.example` をコピーして `.env.local` を作成する
2. 使わないサービスの値は空のままでよい
3. 最初は対象サービスだけ埋める
4. モデルIDを変える場合は、各 `*_MODEL` だけ変更する
5. APIキーやトークンの前後に余計な空白を入れない

設定例:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=xxxxx
GEMINI_MODEL=gemini-2.0-flash

GROQ_API_KEY=xxxxx
GROQ_MODEL=llama-3.1-8b-instant
```

## 4.4.4 実行前チェック

1. `python --version` が通る
2. `.env.local` がこのディレクトリにある
3. 使いたいAPIキーだけ設定済みである
4. モデルIDを独自変更した場合は、そのモデルが利用可能である
5. APIキーの権限不足や無料枠上限超過の可能性を事前に認識しておく

## 5. 実装方針

## 5.1 方針

1. Pythonスクリプトを1本だけ用意する
2. 各APIを固定順序で順番に呼ぶ
3. 各結果を `print()` でそのまま確認する
4. 成功時も失敗時も止めずに次のAPIへ進む

## 5.2 入出力

- 入力プロンプトは固定
  - `Return exactly: HelloWorld`
- 出力項目は最小限
  - `provider`
  - `model`
  - `ok`
  - `output`
  - `error`

## 6. 実施内容

## 6.1 作るもの

以下だけで十分とする。

1. Pythonスクリプト1本
2. 必要ならモデル名・エンドポイント・環境変数名の対応表をスクリプト内に定義

## 6.2 やらないこと

今回のPoCでは以下は対象外とする。

1. Node.js 環境構築
2. Webアプリ組み込み
3. APIルート実装
4. UI作成
5. 結果の永続保存
6. 共通SDK化

## 7. 実行手順

## 7.1 実行方法

導入済みの `python` でスクリプトをそのまま実行する。

```powershell
python .\ai_api_poc.py
```

## 7.2 スクリプトの挙動

1. 対象API一覧を上から順に処理する
2. APIごとに1回だけリクエストする
3. 取得結果またはエラー内容を `print()` する
4. 全件終了したらその時点で完了

出力イメージ:

```text
[gemini] model=gemini-2.0-flash ok=True output=HelloWorld
[groq] model=llama-3.1-8b-instant ok=True output=HelloWorld
[openrouter] model=openrouter/free ok=False error=auth
```

## 7.3 成功判定

以下を満たせばそのAPIは成功とみなす。

1. API呼び出し自体が完了する
2. `ok=True` を出力する
3. `output` が `HelloWorld` と一致する、またはそれに準ずる期待応答を返す

## 8. 最低限の結果整理

今回は `print()` 確認だけで十分とする。  
必要になった場合のみ、後から結果を別ファイルへ転記する。

確認したい観点:

1. どのAPIが成功したか
2. どのAPIが認証エラーだったか
3. どのAPIがクオータやモデル不一致で失敗したか

## 9. 実施順序

1. Gemini
2. Groq
3. OpenRouter
4. Mistral
5. Cohere
6. Hugging Face
7. GitHub Models
8. Cerebras
9. SambaNova
10. Fireworks

## 10. 完了条件チェックリスト

- [ ] 導入済み `python` で単体スクリプトを実行できる
- [ ] 各APIを順番に1回ずつ試行した
- [ ] 各APIの結果が `print()` で確認できる
- [ ] 1件以上の成功、または失敗理由を確認できた

