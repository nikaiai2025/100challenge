---
name: debate
description: マルチAI討論システム。6体のAIが賛成/反対に分かれて討論し、要約・審判を経て止揚的結論を導く。テーマを引数で受け取る。
user-invocable: true
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
model: opus
argument-hint: "[討論テーマ]"
---

# マルチAI討論オーケストレーター

あなたは6体のAIエージェントによる討論を管理するオーケストレーターです。
以下の手順に**厳密に**従い、討論を実行してください。

## 討論テーマ
$ARGUMENTS

---

## Phase 0: 準備

1. Bashツールで `debate_$(date +%Y%m%d_%H%M%S)` ディレクトリをカレントディレクトリ直下に作成する。サブディレクトリ `1_claims/`, `2_summaries/`, `3_report/` も作成する。以降このパスを `WS` と呼ぶ。
2. Readツールで `prompts/debater.md` を読み込む。これはGemini/Codex CLI用のプロンプトテンプレートである。テンプレート内の `{{TOPIC}}` を討論テーマに、`{{STANCE}}` を各エージェントの立場に置換して使用する。

---

## Phase 1: 主張生成（6並列）

以下の6タスクを **すべて同一レスポンス内で並列に** 発行すること。

### Claude 賛成派（Agentツール, subagent_type: "debater", model: "opus"）
- promptに討論テーマ、立場「賛成（この立場を支持する論拠を展開せよ）」、出力先ファイルパス `{WS}/1_claims/pro_claude.md` を渡す

### Claude 反対派（Agentツール, subagent_type: "debater", model: "opus"）
- promptに討論テーマ、立場「反対（この立場に反対する論拠を展開せよ）」、出力先 `{WS}/1_claims/con_claude.md` を渡す

### Gemini 賛成派（Bashツール）
- debater.mdテンプレートを賛成用に置換し、一時ファイル `{WS}/1_claims/.prompt_pro_gemini.txt` に書き出す
- 以下のコマンドを実行:
  ```
  gemini --model gemini-3-pro-preview -p "$(cat {WS}/1_claims/.prompt_pro_gemini.txt)" > {WS}/1_claims/pro_gemini.md 2>/dev/null \
    || gemini -p "$(cat {WS}/1_claims/.prompt_pro_gemini.txt)" > {WS}/1_claims/pro_gemini.md 2>/dev/null \
    || echo "（取得失敗: CLIエラー）" > {WS}/1_claims/pro_gemini.md
  ```

### Gemini 反対派（Bashツール）
- 同上、反対用に置換
- 一時ファイル: `{WS}/1_claims/.prompt_con_gemini.txt`
- 以下のコマンドを実行:
  ```
  gemini --model gemini-3-pro-preview -p "$(cat {WS}/1_claims/.prompt_con_gemini.txt)" > {WS}/1_claims/con_gemini.md 2>/dev/null \
    || gemini -p "$(cat {WS}/1_claims/.prompt_con_gemini.txt)" > {WS}/1_claims/con_gemini.md 2>/dev/null \
    || echo "（取得失敗: CLIエラー）" > {WS}/1_claims/con_gemini.md
  ```

### Codex 賛成派（Bashツール）
- debater.mdテンプレートを賛成用に置換し、一時ファイル `{WS}/1_claims/.prompt_pro_codex.txt` に書き出す
- 以下のコマンドを実行:
  ```
  codex exec --model gpt-5.4 "$(cat {WS}/1_claims/.prompt_pro_codex.txt)" > {WS}/1_claims/pro_codex.md 2>/dev/null \
    || codex exec "$(cat {WS}/1_claims/.prompt_pro_codex.txt)" > {WS}/1_claims/pro_codex.md 2>/dev/null \
    || echo "（取得失敗: CLIエラー）" > {WS}/1_claims/pro_codex.md
  ```

### Codex 反対派（Bashツール）
- 同上、反対用に置換
- 一時ファイル: `{WS}/1_claims/.prompt_con_codex.txt`
- 以下のコマンドを実行:
  ```
  codex exec --model gpt-5.4 "$(cat {WS}/1_claims/.prompt_con_codex.txt)" > {WS}/1_claims/con_codex.md 2>/dev/null \
    || codex exec "$(cat {WS}/1_claims/.prompt_con_codex.txt)" > {WS}/1_claims/con_codex.md 2>/dev/null \
    || echo "（取得失敗: CLIエラー）" > {WS}/1_claims/con_codex.md
  ```

### エラーハンドリング
- 各CLI呼び出しは3段階: (1) 最高性能モデル指定 → (2) モデル指定なしフォールバック → (3) エラーメッセージ書き込み
- `||` チェーンにより、前段が失敗した場合のみ次段が実行される

---

## Phase 2: 要約（2並列）

**重要: オーケストレーター自身はclaimsフォルダ内のファイルを読んではならない。**

以下の2タスクを **同一レスポンス内で並列に** Agentツール（subagent_type: "summarizer", model: "opus"）で発行する。

### 賛成派サマライザー
- promptに以下を渡す:
  - 担当立場: 賛成派
  - 入力ファイル: `{WS}/1_claims/pro_claude.md`, `{WS}/1_claims/pro_gemini.md`, `{WS}/1_claims/pro_codex.md`
  - 出力先: `{WS}/2_summaries/pro_summary.md`

### 反対派サマライザー
- promptに以下を渡す:
  - 担当立場: 反対派
  - 入力ファイル: `{WS}/1_claims/con_claude.md`, `{WS}/1_claims/con_gemini.md`, `{WS}/1_claims/con_codex.md`
  - 出力先: `{WS}/2_summaries/con_summary.md`

---

## Phase 3: 審判（1タスク）

**重要: オーケストレーター自身はsummariesフォルダ内のファイルを読んではならない。**

Agentツール（subagent_type: "judge", model: "opus"）で以下の1タスクを発行する。

### 審判
- promptに以下を渡す:
  - 討論テーマ
  - 入力ファイル: `{WS}/2_summaries/pro_summary.md`, `{WS}/2_summaries/con_summary.md`
  - 出力先: `{WS}/3_report/final_report.md`

---

## Phase 4: 報告

ユーザーに以下を通知する:
- ワークスペースのパス
- 生成されたファイル一覧（`ls -R {WS}` の結果）
- 最終レポートのパス（`{WS}/3_report/final_report.md`）

**最終レポートの中身は表示しない。** ユーザーが自分で読むことを案内する。

---

## 厳守事項

- オーケストレーターは `1_claims/` と `2_summaries/` の**中身を読まない**。パスの受け渡しのみ行う
- Phase間の依存（Phase 2はPhase 1完了後、Phase 3はPhase 2完了後）を必ず守る
- 各Phase内の並列実行は最大限に活用する
- すべての出力ファイルはMarkdown形式
- 一時プロンプトファイル（`.prompt_*`）はドットプレフィクスで作成する
