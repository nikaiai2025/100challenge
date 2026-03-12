# BattleBoard向け AI API 調査・選定レポート（2026-03-09）

作成日: 2026-03-09（JST）  
対象プロジェクト: `battle_board`（Next.js on Vercel 前提）

## 1. サマリ（無料枠重視の比較観点）

- 無料枠が明記されるAPI（Gemini / OpenRouter / Mistral Experiment / Cohere Trial）が存在する。
- 無料枠はレート制限・日次上限・サポート範囲が異なるため、同一条件で比較が必要。
- 有料APIは価格体系（input/output/cached input）と運用要件（組織設定・課金方式）に差がある。
- Vercel運用では、環境変数設計とプロバイダ切替方式（単一/複数）を先に決めると実装が安定する。

---

## 2. 調査対象（カテゴリ網羅）

### 2.1 直接プロバイダAPI
- OpenAI API
- Anthropic API
- Google Gemini API
- xAI API (Grok)
- Groq API
- Together AI API
- Fireworks AI API
- Cerebras Inference API
- SambaNova API
- Mistral API
- Cohere API
- DeepSeek API
- Perplexity API
- Replicate API

### 2.2 集約/ルータ
- OpenRouter
- Hugging Face Inference Providers
- Vercel AI Gateway

### 2.3 クラウド統合型
- Amazon Bedrock
- Azure OpenAI
- GitHub Models

### 2.4 実行基盤（APIそのものではない）
- Cloudflare Workers / Workers AI（今回プロジェクト制約上は選定対象外）

---

## 3. 一覧比較（無料/有料の観点）

| カテゴリ | 代表モデル（例） | 無料枠 | 有料利用 | 備考 |
|---|---|---|---|---|
| OpenAI | GPT-5.2, GPT-5 mini | 基本なし（実質プリペイド/課金前提） | あり | 高品質、価格はトークン課金 |
| Anthropic | Claude Sonnet 4, Claude Haiku 3.5 | 公式価格ページに「少額無料クレジット」記載あり（要最新確認） | あり | ConsoleでAPIキー管理 |
| Gemini | Gemini 2.5 Flash, Gemini 2.0 Flash | **あり（Free Tier明示）** | あり | Free Tierと有料Tierを段階的に利用しやすい |
| xAI | grok-4-fast-reasoning, grok-4 | 基本なし（クレジットチャージ型） | あり | OpenAI互換で移行しやすい |
| Groq | `openai/gpt-oss-120b`, `llama-3.1-8b-instant` | **あり（Free Tier）** | あり | 低遅延が強み、OpenAI互換 |
| Together AI | `openai/gpt-oss-20b`, `meta-llama/*` | 無料トライアルなし（最低$5クレジット購入） | あり | OpenAI互換で多数OSSモデルを提供 |
| Fireworks AI | `accounts/fireworks/models/llama-v3p1-8b-instruct` 等 | **あり（新規無料クレジット）** | あり | Serverless/On-demandの両対応 |
| Cerebras | `gpt-oss-120b`, `llama3.1-8b` | **あり（Free Tier）** | あり | 高速推論特化、OpenAI互換 |
| SambaNova | `Meta-Llama-3.3-70B-Instruct` 等 | **あり（$5初期クレジット/30日）** | あり | OpenAI互換エンドポイントあり |
| Mistral | mistral-medium-latest, mistral-small-latest | **Experiment無料プランあり** | あり | 無料プランは制限あり |
| Cohere | Command A, Command R+ | **Trial API key無料**（制限あり） | あり | Trial/Prodキーが分離 |
| DeepSeek | deepseek-chat, deepseek-reasoner | 公式に恒久無料枠の明記は弱い（残高運用） | あり | 単価が安価、OpenAI互換 |
| Perplexity | `sonar-pro`, Agent API(他社モデル) | 無料枠の恒久提供は明記弱め（Tier 0は制限大） | あり | 検索統合APIが強み |
| Replicate | 各種公開/非公開モデル | 恒久無料枠の明記は弱い（従量課金中心） | あり | 画像/動画/音声など非LLM領域が強い |
| OpenRouter | openrouter/free, `*:free` | **あり**（50 req/day等） | あり | 複数プロバイダ統合 |
| Hugging Face Inference Providers | `openai/gpt-oss-120b`, `meta-llama/*` 等 | **あり**（月次クレジット） | あり | ルータ経由で複数社モデルを利用可能 |
| Bedrock | Claude/Llama等をBedrock経由 | Bedrock固有無料枠は薄い（AWSクレジット活用） | あり | IAM前提、企業向け統制 |
| Azure OpenAI | GPT-4.1系等（デプロイ名利用） | サービス固有無料枠は薄い（Azure $200クレジット活用） | あり | Entra/企業統制に強い |
| GitHub Models | OpenAI/DeepSeek/Meta等のカタログ | **あり**（全アカウントで無料・rate-limited） | あり（opt-in） | GitHub認証で統一API利用 |

---

## 4. モデル別 深掘り（代表のみ）

## 4.1 OpenAIカテゴリ

### モデル: GPT-5.2
- 有料/無料: **有料**
- 価格目安: Input `$1.75 / 1M tokens`、Output `$14.00 / 1M tokens`
- 利用開始:
  1. OpenAIアカウント作成
  2. APIキー発行
  3. Billing設定（プリペイド or カード課金）
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/openai
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development
```
- 開発者メモ:
  - OpenAI APIは高機能だが無料枠前提には向かない。
  - コスト最適化には `gpt-5-mini` やBatch系の活用が有効。

### モデル: GPT-5 mini
- 有料/無料: **有料**
- 価格目安: Input `$0.25 / 1M`、Output `$2.00 / 1M`
- 利用開始: 上記同様
- Vercel想定コマンド: 上記同様
- 開発者メモ:
  - コストと品質のバランスがよく、掲示板ボット用途で採用しやすい。

## 4.2 Anthropicカテゴリ

### モデル: Claude Sonnet 4
- 有料/無料: **基本有料**（少額無料クレジット言及あり、都度確認）
- 価格目安: Input `$3 / MTok`、Output `$15 / MTok`
- 利用開始:
  1. Anthropic Consoleアカウント作成
  2. Workspace作成、APIキー発行
  3. Billing（クレジット購入）
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/anthropic
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY preview
vercel env add ANTHROPIC_API_KEY development
```
- 開発者メモ:
  - 長文生成品質は高評価。価格はGemini freeやDeepSeekより高い。

### モデル: Claude Haiku 3.5
- 有料/無料: **有料中心**
- 価格目安: Input `$0.80 / MTok`、Output `$4 / MTok`
- 利用開始/コマンド: Sonnet 4と同様
- 開発者メモ:
  - Sonnetより安価で高速。大量レス生成の費用圧縮に向く。

## 4.3 Geminiカテゴリ

### モデル: Gemini 2.5 Flash
- 有料/無料: **無料Tierあり + 有料Tierあり**
- 価格目安（有料Tier）: Input `$0.30 / 1M`、Output `$2.50 / 1M`
- 利用開始:
  1. Google AI StudioでAPIキー取得（無料）
  2. 必要なら有料Tierへ移行
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/google
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
vercel env add GOOGLE_GENERATIVE_AI_API_KEY preview
vercel env add GOOGLE_GENERATIVE_AI_API_KEY development
```
- 開発者メモ:
  - 無料枠が明確でPoCに最適。
  - Free Tierはレート制限（RPM/RPD）あり。

### モデル: Gemini 2.0 Flash
- 有料/無料: **無料Tierあり + 有料Tierあり**
- 価格目安（有料Tier）: Input `$0.10 / 1M`、Output `$0.40 / 1M`（2.0 Flash系テーブル）
- 利用開始/コマンド: 2.5 Flash同様
- 開発者メモ:
  - 低コスト・高速。掲示板向け短文応答には十分なケースが多い。

## 4.4 xAIカテゴリ

### モデル: grok-4-fast-reasoning
- 有料/無料: **有料**
- 価格目安: Input `$0.20 / 1M`、Output `$0.50 / 1M`
- 利用開始:
  1. xAIアカウント作成
  2. クレジットをチャージ
  3. APIキー発行
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/xai
vercel env add XAI_API_KEY production
vercel env add XAI_API_KEY preview
vercel env add XAI_API_KEY development
```
- 開発者メモ:
  - OpenAI互換性が高く、移行コストが低い。

### モデル: grok-4
- 有料/無料: **有料**
- 価格目安: Input `$3.00 / 1M`、Output `$15.00 / 1M`
- 利用開始/コマンド: 同様
- 開発者メモ:
  - 高品質だが単価は高め。

## 4.5 Groqカテゴリ

### モデル: `openai/gpt-oss-120b`（Groq提供）
- 有料/無料: **無料Tierあり + 有料Tierあり**
- 価格目安（有料）: Input `$0.15 / 1M`、Cached Input `$0.075 / 1M`、Output `$0.60 / 1M`
- 利用開始:
  1. Groqアカウント作成
  2. APIキー発行（console）
  3. 必要に応じ有料Tierへアップグレード
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/groq
vercel env add GROQ_API_KEY production
vercel env add GROQ_API_KEY preview
vercel env add GROQ_API_KEY development
```
- 開発者メモ:
  - OpenAI互換エンドポイント (`https://api.groq.com/openai/v1`) で既存コードを移植しやすい。
  - 低遅延が強み。無料Tierはレート制限あり。

### モデル: `llama-3.1-8b-instant`
- 有料/無料: **無料Tierあり + 有料Tierあり**
- 価格目安（有料）: Input `$0.05 / 1M`、Output `$0.08 / 1M`
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 短文応答・リアルタイム用途のコスト効率が高い。

## 4.6 Mistralカテゴリ

### モデル: mistral-medium-latest
- 有料/無料: **無料Experimentプランあり / 本番は有料Scale想定**
- 価格目安: API pricingページ参照（モデルごと）
- 利用開始:
  1. Mistralアカウント作成
  2. （無料利用なら）Experimentプラン有効化（電話番号認証）
  3. APIキー発行
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/mistral
vercel env add MISTRAL_API_KEY production
vercel env add MISTRAL_API_KEY preview
vercel env add MISTRAL_API_KEY development
```
- 開発者メモ:
  - 無料導入の敷居が比較的低い。制限条件は必ず最新確認。

### モデル: mistral-small-latest
- 有料/無料: **無料Experiment対象になり得る**
- 価格目安: API pricingページ参照
- 利用開始/コマンド: 同様
- 開発者メモ:
  - コスト効率重視の大量処理向き。

## 4.7 Cohereカテゴリ

### モデル: Command A
- 有料/無料: **Trial keyで無料利用可（制限あり）**
- 価格目安: Input `$2.50 / 1M`、Output `$10.00 / 1M`
- 利用開始:
  1. CohereダッシュボードでAPI key作成
  2. Trial key or Production keyを選択
- Vercel想定コマンド（OpenAI互換経由）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add COHERE_API_KEY production
vercel env add COHERE_API_KEY preview
vercel env add COHERE_API_KEY development
```
- 開発者メモ:
  - Trialは月間コール数制限あり。本番はProduction keyへ移行。

### モデル: Command R+
- 有料/無料: **Trial keyで無料試用可（制限あり）**
- 価格目安: Input `$2.50 / 1M`、Output `$10.00 / 1M`
- 利用開始/コマンド: 同様
- 開発者メモ:
  - エンタープライズRAG系実績が強み。

## 4.8 DeepSeekカテゴリ

### モデル: deepseek-chat
- 有料/無料: **有料（残高課金）**
- 価格目安: Input (cache miss) `$0.28 / 1M`、Output `$0.42 / 1M`
- 利用開始:
  1. DeepSeek APIキー取得
  2. 残高チャージ
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add DEEPSEEK_API_KEY production
vercel env add DEEPSEEK_API_KEY preview
vercel env add DEEPSEEK_API_KEY development
```
- 開発者メモ:
  - 低コストが魅力。OpenAI互換で実装しやすい。

### モデル: deepseek-reasoner
- 有料/無料: **有料**
- 価格目安: Input (cache miss) `$0.55 / 1M`、Output `$2.19 / 1M`
- 利用開始/コマンド: 同様
- 開発者メモ:
  - 推論重視だが、`chat`より単価は上がる。

## 4.9 OpenRouterカテゴリ

### モデル: openrouter/free（Free Models Router）
- 有料/無料: **無料**（制限あり）
- 価格目安: `$0/M input` `$0/M output`
- 利用開始:
  1. OpenRouterでAPIキー作成
  2. 必要に応じクレジット購入（無料モデルRPD上限改善）
- Vercel想定コマンド:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add OPENROUTER_API_KEY production
vercel env add OPENROUTER_API_KEY preview
vercel env add OPENROUTER_API_KEY development
```
- 開発者メモ:
  - 無料プランは原則 50 req/day。検証用途向け。

### モデル: `meta-llama/llama-3.2-3b-instruct:free`（例）
- 有料/無料: **無料バリアント**
- 価格目安: 無料
- 利用開始/コマンド: 同様
- 開発者メモ:
  - `:free`は可用性・レート制限が本番向きでない場合がある。

## 4.10 Hugging Face Inference Providersカテゴリ

### モデル: `openai/gpt-oss-120b`（HFルータ経由の例）
- 有料/無料: **無料枠あり（月次クレジット） + 有料**
- 価格目安: HFは「プロバイダ原価をそのまま請求（マークアップなし）」方針
- 利用開始:
  1. Hugging Faceアカウント作成
  2. Fine-grained tokenを作成（Inference Providers権限）
  3. 必要に応じPRO/Teamでクレジット拡張・従量課金
- Vercel想定コマンド（OpenAI互換経由）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add HF_TOKEN production
vercel env add HF_TOKEN preview
vercel env add HF_TOKEN development
```
- 開発者メモ:
  - 単一トークンで複数推論プロバイダへルーティング可能。
  - `:fastest` / `:cheapest` のルーティング指定が使える。

### モデル: `meta-llama/Llama-3.1-8B-Instruct`（HF上の代表例）
- 有料/無料: **無料クレジット内は無料、超過後はプラン依存**
- 価格目安: 利用プロバイダに依存
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - OSSモデル比較検証に向く。

## 4.11 Amazon Bedrockカテゴリ（クラウド統合）

### 代表モデル: Claude Sonnet系 / Llama系（Bedrock経由）
- 有料/無料: **有料中心**（AWS新規アカウントのFree Tierクレジット活用余地あり）
- 価格目安: モデル・リージョン別のため都度確認
- 利用開始:
  1. AWSアカウント/IAM設定
  2. BedrockのAPI key または IAMロール設定
  3. モデルアクセス許可
- Vercel想定コマンド:
```bash
# IAMロール利用が理想。鍵利用時は最小権限で
vercel env add AWS_REGION production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
```
- 開発者メモ:
  - 企業向けガバナンス重視なら有力。

## 4.12 Azure OpenAIカテゴリ（クラウド統合）

### 代表モデル: GPT-4.1-nano（Azureデプロイ）
- 有料/無料: **有料中心**（Azure Free Accountの`$200`クレジットは活用可能）
- 価格目安: デプロイ形態/リージョンで変動
- 利用開始:
  1. Azure契約作成
  2. Azure OpenAIリソース作成
  3. モデルをデプロイ（デプロイ名を決定）
  4. Endpoint/Key取得
- Vercel想定コマンド:
```bash
vercel env add AZURE_OPENAI_API_KEY production
vercel env add AZURE_OPENAI_ENDPOINT production
vercel env add AZURE_OPENAI_DEPLOYMENT_NAME production
```
- 開発者メモ:
  - Azureは「モデル名」ではなく「デプロイ名」で呼ぶ点に注意。

## 4.13 GitHub Modelsカテゴリ（クラウド統合/API統合）

### モデル: `openai/gpt-4o`（GitHub Modelsカタログの例）
- 有料/無料: **無料（rate-limited） + 有料opt-in**
- 価格目安（有料opt-in）: `$0.00001 / token unit`（統一単価）
- 利用開始:
  1. GitHubアカウントでModelsを有効化
  2. PAT（fine-grained）またはGitHub Appで `models:read` 権限付与
  3. 必要に応じて課金opt-in
- Vercel想定コマンド（OpenAI互換として利用）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add GITHUB_MODELS_TOKEN production
vercel env add GITHUB_MODELS_TOKEN preview
vercel env add GITHUB_MODELS_TOKEN development
```
- 開発者メモ:
  - エンドポイントは `https://models.github.ai/inference` を使用。
  - 組織帰属は `https://models.github.ai/orgs/{org}/inference` を利用可能。

### モデル: `deepseek/DeepSeek-V3-0324`（GitHub Models提供例）
- 有料/無料: **無料（rate-limited） + 有料opt-in**
- 価格目安: モデルごとの multiplier で token unit換算
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 単一認証で複数ベンダーモデルを横並び比較しやすい。

## 4.14 Together AIカテゴリ

### モデル: `openai/gpt-oss-20b`
- 有料/無料: **有料**（無料トライアルなし、最低$5クレジット購入）
- 価格目安: Input `$0.05 / 1M`、Output `$0.20 / 1M`
- 利用開始:
  1. Togetherアカウント作成
  2. クレジット購入（最低$5）
  3. APIキー発行
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add TOGETHER_API_KEY production
vercel env add TOGETHER_API_KEY preview
vercel env add TOGETHER_API_KEY development
```
- 開発者メモ:
  - OpenAI互換で移植しやすい。
  - モデル数が多いので、用途別にモデルIDを固定化して運用するのが安全。

### モデル: `meta-llama/Llama-3.2-3B-Instruct-Turbo`
- 有料/無料: **有料**
- 価格目安: Input/Output 各 `$0.06 / 1M`（Serverless pricing表）
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 小型モデルで低コスト検証に向く。

## 4.15 Fireworks AIカテゴリ

### モデル: `accounts/fireworks/models/llama-v3p1-8b-instruct`（代表例）
- 有料/無料: **新規無料クレジットあり + 従量課金**
- 価格目安: モデル別に従量課金（serverlessはトークン課金）
- 利用開始:
  1. Fireworksアカウント作成
  2. APIキー発行
  3. 無料クレジット消化後は従量課金
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add FIREWORKS_API_KEY production
vercel env add FIREWORKS_API_KEY preview
vercel env add FIREWORKS_API_KEY development
```
- 開発者メモ:
  - Serverless（速く開始）とOn-demand（専有GPU）で運用を切り替え可能。

### モデル: `accounts/fireworks/models/deepseek-r1`（代表例）
- 有料/無料: **新規無料クレジットあり + 従量課金**
- 価格目安: モデル別価格表を参照
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - fine-tune配備形態ごとに課金構造が異なるため事前確認が必要。

## 4.16 Cerebrasカテゴリ

### モデル: `gpt-oss-120b`
- 有料/無料: **Free Tierあり + Developer/Enterprise有料**
- 価格目安（Developer）: Input `$0.30 / 1M`、Output `$0.60 / 1M`
- 利用開始:
  1. Cerebrasアカウント作成
  2. APIキー発行（Free開始可）
  3. 必要時にDeveloperへアップグレード
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add CEREBRAS_API_KEY production
vercel env add CEREBRAS_API_KEY preview
vercel env add CEREBRAS_API_KEY development
```
- 開発者メモ:
  - 速度重視比較で有効。Free Tierのレート/日次上限を確認して運用する。

### モデル: `llama3.1-8b`
- 有料/無料: **Free Tierあり + Developer/Enterprise有料**
- 価格目安（Developer）: Input/Output 各 `$0.10 / 1M`
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 低コストかつ低遅延の比較軸として使いやすい。

## 4.17 SambaNovaカテゴリ

### モデル: `Meta-Llama-3.3-70B-Instruct`
- 有料/無料: **$5初期クレジットあり（30日） + 従量課金**
- 価格目安: モデル別のオンデマンド価格表を参照
- 利用開始:
  1. SambaNova Cloudアカウント作成
  2. APIキー発行（最大25キー）
  3. Base URL `https://api.sambanova.ai/v1` で接続
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add SAMBANOVA_API_KEY production
vercel env add SAMBANOVA_API_KEY preview
vercel env add SAMBANOVA_API_KEY development
```
- 開発者メモ:
  - OpenAI clientで接続しやすく、既存実装を再利用しやすい。

### モデル: `Meta-Llama-3.1-405B-Instruct`（代表例）
- 有料/無料: **$5初期クレジットあり + 従量課金**
- 価格目安: モデル別のオンデマンド価格表を参照
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 大規模モデルは速度・コスト双方を要評価。

## 4.18 Perplexityカテゴリ

### モデル: `sonar-pro`
- 有料/無料: **有料**（Usage Tierで上限管理）
- 価格目安: Input `$3 / 1M`、Output `$15 / 1M`（Sonar pricing表）
- 利用開始:
  1. Perplexity API portalでAPIキー発行
  2. 使用量に応じてtierが上がる仕組みを確認
- Vercel想定コマンド（OpenAI互換）:
```bash
npm i ai @ai-sdk/openai-compatible
vercel env add PERPLEXITY_API_KEY production
vercel env add PERPLEXITY_API_KEY preview
vercel env add PERPLEXITY_API_KEY development
```
- 開発者メモ:
  - Web検索統合が強み。モデルトークン課金に加えて `web_search` などのツール課金が発生する。

### モデル: Agent API（例: OpenAI/Anthropic/Google/xAIモデルを統一APIで利用）
- 有料/無料: **有料**
- 価格目安: 「provider直課金相当（no markup）」の記載あり
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 1つのAPIキーで複数プロバイダモデル＋検索機能を扱える。

## 4.19 Replicateカテゴリ

### モデル: `black-forest-labs/flux-schnell`（代表例）
- 有料/無料: **有料（従量課金中心）**
- 価格目安: モデルにより「実行時間課金」または「トークン課金」
- 利用開始:
  1. Replicateアカウント作成
  2. `REPLICATE_API_TOKEN` を取得
  3. 利用モデルごとの課金方式を確認
- Vercel想定コマンド:
```bash
npm i replicate
vercel env add REPLICATE_API_TOKEN production
vercel env add REPLICATE_API_TOKEN preview
vercel env add REPLICATE_API_TOKEN development
```
- 開発者メモ:
  - 画像/動画/音声含めたマルチモーダル拡張に強い。

### モデル: `anthropic/claude-3.7-sonnet`（Replicate提供例）
- 有料/無料: **有料**
- 価格目安: 例として Input `$3.00 / 1M`、Output `$15.00 / 1M` の掲載あり
- 利用開始/コマンド: 上記同様
- 開発者メモ:
  - 同一プラットフォーム上で異種モデル比較がしやすい。

---

## 5. Vercel実装パターン（BattleBoard向け）

### パターンA: 単一プロバイダ構成
- 1プロバイダ + 1〜2モデルで開始し、実装を最小化する。
- 失敗時は同一プロバイダ内の軽量モデルへフォールバックする。

### パターンB: 複数プロバイダ構成
- Vercel AI Gatewayまたはアプリ側ルーティングで、複数APIを切り替える。
- 障害回避・コスト最適化・用途別ルーティング（短文/長文/推論）を行う。

### パターンC: 無料枠優先の検証構成
- 無料枠のあるAPIを並行接続し、品質/レイテンシ/制限値を同一プロンプトで比較する。
- 上限到達時の自動切替条件（429/クオータ超過）を事前に定義する。

---

## 6. 後続開発者向けインプット（重要）

- 秘密情報は必ずサーバー側でのみ利用（このプロジェクト制約と一致）。
- Bot投稿は既存の投稿API経由で行う（直接DB更新禁止）。
- 無料枠モデルはレート制限・SLAが厳しいため本番固定は危険。
- APIコスト上限を先に決める（1日/1スレッド/1ユーザーあたり）。
- 監視項目: 失敗率、遅延、1投稿あたりトークン、モデル切替率。
- モデル更新の差分テスト（口調・煽り耐性・安全性）をBDDに反映。

---

## 7. 評価テンプレート（選定を保留したまま使える形式）

以下テンプレートで、複数モデルを横並び評価する。

| 評価軸 | 記録内容（例） |
|---|---|
| API/モデル名 | `gemini-2.5-flash` / `gpt-5-mini` など |
| 無料/有料区分 | 無料枠あり・有料のみ・試用のみ |
| 料金 | input/output/cached input 単価 |
| 制限 | RPM/RPD/TPM、同時実行数、無料枠上限 |
| 導入手順 | 登録、キー発行、課金設定、審査有無 |
| Vercel設定 | 必要env名、SDKパッケージ、リージョン注意点 |
| 品質検証 | BDDシナリオに対する合格率・失敗傾向 |
| 運用性 | 障害時代替、監視項目、ログ取得性 |

---

## 8. 参照ソース（公式中心）

### OpenAI
- Pricing: https://platform.openai.com/docs/pricing/
- Developer quickstart: https://platform.openai.com/docs/quickstart
- Help (prepaid billing): https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing

### Anthropic
- Pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- API getting started: https://docs.anthropic.com/en/api/getting-started
- Billing help: https://support.anthropic.com/en/articles/8977456-how-do-i-pay-for-my-api-usage

### Google Gemini
- Pricing: https://ai.google.dev/pricing
- Quickstart: https://ai.google.dev/gemini-api/docs/quickstart
- Quotas (Free Tier含む): https://ai.google.dev/gemini-api/docs/quota

### xAI
- Quickstart: https://docs.x.ai/developers/quickstart
- Models & pricing: https://x.ai/api

### Groq
- Models & pricing: https://console.groq.com/docs/models
- Rate limits (Free/Developer比較): https://console.groq.com/docs/rate-limits
- OpenAI compatibility: https://console.groq.com/docs/openai

### Together AI
- Quickstart: https://docs.together.ai/docs/quickstart
- Pricing: https://www.together.ai/pricing
- Billing credits (最低$5): https://docs.together.ai/docs/billing-credits

### Fireworks AI
- Pricing structure: https://docs.fireworks.ai/faq/billing-pricing-usage/pricing/cost-structure
- Billing FAQ: https://docs.fireworks.ai/faq/billing-pricing-usage

### Cerebras
- Pricing: https://www.cerebras.ai/pricing
- Rate limits: https://inference-docs.cerebras.ai/support/rate-limits

### SambaNova
- Quickstart: https://docs.sambanova.ai/cloud/docs/get-started/quickstart
- Models (OpenAI-compatible): https://docs.sambanova.ai/cloud/docs/models
- Plans: https://cloud.sambanova.ai/plans

### Mistral
- API pricing: https://docs.mistral.ai/getting-started/pricing/
- Quickstart: https://docs.mistral.ai/getting-started/quickstart/
- Experiment free plan: https://help.mistral.ai/en/articles/450104-how-can-i-try-the-api-for-free-with-the-experiment-plan

### Cohere
- Pricing: https://cohere.com/pricing
- API keys / trial key導線: https://docs.cohere.com/docs/rate-limits

### DeepSeek
- First API call: https://api-docs.deepseek.com/
- Models & pricing: https://api-docs.deepseek.com/quick_start/pricing/

### OpenRouter
- Pricing plans: https://openrouter.ai/pricing
- Quickstart: https://openrouter.ai/docs/quick-start
- API keys: https://openrouter.ai/docs/api-keys
- FAQ (free limit): https://openrouter.ai/docs/faq
- Free router: https://openrouter.ai/openrouter/free
- `:free` variant: https://openrouter.ai/docs/guides/routing/model-variants/free

### Hugging Face Inference Providers
- Overview: https://huggingface.co/docs/inference-providers/en/index
- Pricing & billing: https://huggingface.co/docs/inference-providers/pricing
- OpenAI-compatible API: https://huggingface.co/changelog/inference-providers-openai-compatible

### GitHub Models
- Quickstart: https://docs.github.com/en/enterprise-cloud@latest/github-models/quickstart
- Inference API: https://docs.github.com/en/rest/models/inference
- Billing: https://docs.github.com/en/billing/concepts/product-billing/github-models

### Perplexity
- Pricing: https://docs.perplexity.ai/guides/pricing
- API models & pricing: https://docs.perplexity.ai/models/model-cards

### Replicate
- Pricing: https://replicate.com/pricing
- API reference: https://replicate.com/docs/reference/http
- Billing concepts: https://replicate.com/docs/billing

### Vercel / AI SDK
- `vercel env`: https://vercel.com/docs/cli/env
- AI Gateway overview: https://vercel.com/docs/ai-gateway/
- AI Gateway authentication: https://vercel.com/docs/ai-gateway/authentication
- AI SDK provider (OpenAI): https://ai-sdk.dev/docs/guides/openai
- AI SDK provider (Anthropic): https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- AI SDK provider (Google): https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
- AI SDK provider (xAI): https://ai-sdk.dev/providers/ai-sdk-providers/xai
- AI SDK provider (Groq): https://ai-sdk.dev/providers/ai-sdk-providers/groq
- AI SDK provider (Mistral): https://ai-sdk.dev/providers/ai-sdk-providers/mistral
- OpenAI-compatible providers: https://ai-sdk.dev/providers/openai-compatible-providers

### AWS / Azure
- Bedrock pricing: https://aws.amazon.com/bedrock/pricing/
- Bedrock API keys: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html
- Bedrock 30-day API key quickstart: https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html
- AWS Free Tier update ($200 credits): https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan
- Azure OpenAI pricing: https://azure.microsoft.com/en-au/pricing/details/azure-openai/
- Azure OpenAI quickstart: https://learn.microsoft.com/en-us/azure//ai-services/openai/quickstart
- Azure free account ($200 credit): https://azure.microsoft.com/en-us/free/free-account-faq

### Cloudflare（補足: 実行基盤）
- Workers AI: https://workers.cloudflare.com/product/workers-ai
- AI Gateway overview: https://developers.cloudflare.com/ai-gateway/
