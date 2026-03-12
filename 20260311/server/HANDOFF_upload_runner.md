# upload_runner.js 引き継ぎメモ

**作成日時：** 2026-03-12  
**調査・修正者：** Antigravity (AI)  
**対象ファイル：** `server/upload_runner.js`

---

## ✅ 修正済みバグ：`pollOperation` のパス二重付与

### 経緯

`uploadToFileSearchStore` で1件アップロードすると200 OK は返るが、
その後 **poll が `{}` を延々と返し続けてハング** するという現象が発生していた。

### 根本原因

`pollOperation` 関数（旧87行目）のパス組み立てロジックが間違っていた。

```js
// ❌ 修正前（バグあり）
const cleaned = name.startsWith('operations/') ? name : `operations/${name}`;
const endpoint = `${apiBase}/${cleaned}?key=...`;
```

`uploadToFileSearchStore` API が返す `name` の形式は：

```
fileSearchStores/aozora100store-xxxxxx/upload/operations/txt-yyyyyyy
```

これは `operations/` で **始まっていない** ため、
誤って `operations/fileSearchStores/...` という存在しないURLが生成されていた。

APIはそのURLに対して `{}` を返し続けるため、
`data.done` が永遠に `true` にならず、**最大 pollMaxAttempts × pollIntervalMs ≒ 120秒ハング**していた。

### 修正内容

```js
// ✅ 修正後
// name は "fileSearchStores/xxx/upload/operations/yyy" 形式 → そのままパスに使う
const endpoint = `${apiBase}/${name}?key=...`;
```

### 副次的な改善点

- リクエストボディを `string` から `Buffer.from(body, 'utf-8')` に変更
  - 日本語テキストのバイト数を正確に送信するため
- `Content-Length` ヘッダーをバイト数で明示的に付与

---

## ⚠️ 残課題・既知の問題

### 1. フルサイズJPテキスト（~145KB）での「Failed to count tokens.」エラー

コメントにも記載されているが、長い日本語テキストをそのままアップロードすると
APIサイドでトークンカウントに失敗することがある。

**現状の回避策：**
- `.env` に `UPLOAD_TRUNCATE_CHARS=2000` などを設定して文字数を絞る
- または `CHUNK_TOKENS` を下げる（デフォルト400）

**より根本的な解決策（未実装）：**
- アップロード前にファイルを分割する
- テキストのクリーニング（ルビ、HTMLタグの除去）を徹底する
- Gemini API の File Upload（Files API）経由での代替を検討

### 2. 503 エラー（断続的）

サービス側の一時的な過負荷。現在の指数バックオフリトライ（retryMax=3）で概ね対応できているが、
失敗ログを保存して後で再試行できる仕組みがあると安心。

---

## 🗂️ 全体アーキテクチャの把握ポイント

| ファイル | 役割 |
|---|---|
| `upload_runner.js` | コア処理（Store作成・アップロード・ポーリング）|
| `upload_cli.js` | CLIエントリポイント。`.store_id` ファイルへの保存も担当 |
| `build_upload_manifest.js` | アップロード対象リストの生成 |
| `upload_manifest.json` | マニフェスト（なければ `Aozora_Texts_Preprocessed/` から自動スキャン） |
| `doc_id_map.jsonl` | ファイル名 → doc_id のマッピング |
| `.env` | APIキー・各種チューニングパラメータ |

### 主なチューニングパラメータ（`.env`）

```
GEMINI_API_KEY=...
FILE_SEARCH_STORE_ID=...         # 既存のStoreを使う場合は必須
UPLOAD_LIMIT=5                   # 一度にアップロードする件数制限（0=無制限）
UPLOAD_OFFSET=0                  # マニフェストの読み飛ばし件数
UPLOAD_TEST_FILE=path/to/a.txt   # 1ファイルだけテストするとき
UPLOAD_TRUNCATE_CHARS=2000       # ファイルを先頭N文字に切り詰め（0=切り詰めなし）
CHUNK_TOKENS=400                 # チャンクあたりの最大トークン数
CHUNK_OVERLAP=40                 # チャンク間のオーバーラップトークン数
UPLOAD_DELAY_MS=1200             # ファイル間のウェイト（レート制限対策）
UPLOAD_RETRY_MAX=3               # リトライ上限
POLL_MAX_ATTEMPTS=60             # ポーリング上限（× POLL_INTERVAL_MS が最大待ち時間）
```

---

## 💬 元コード作者へのメッセージ

こんにちは。あなたが書いた `upload_runner.js` のデバッグを引き受けました。

**まず率直に言うと、コードのクオリティは高いです。**

- `.env` の丁寧なパース、安全なデフォルト値
- 指数バックオフ付きリトライ
- マニフェストによる再実行可能な設計
- コメントに「観測されたエラー」を記録していること

これらはよく考えられた実装で、デバッグしやすかったです。

バグは `pollOperation` のたった1行でした。
`fileSearchStores/.../upload/operations/xxx` という形式の `name` に対して
`operations/` を前置する判定が逆に機能してしまっていた、というものです。
おそらく最初に設計したときは別のAPI形式を想定していたのではないかと思います。

---

### アドバイス

**1. poll URLのログをデバッグ時に出力しておくと一目でわかります**

今回、ポーリングログを追加して「URL が `operations/fileSearchStores/...` になっている」と
即座に気づくことができました。本番では不要ですが、デバッグ時のフラグとして
`DEBUG=1` のような環境変数で切り替えられると便利です。

**2. フルサイズのJPテキストは現状 API の制限に当たる可能性が高いです**

`uploadTruncateChars` を使った切り詰めは暫定対策ですが、
文脈を保ったチャンク検索をするなら **先にテキスト前処理（ルビ除去・正規化）を徹底した上で
2,000〜5,000文字ごとに分割アップロード**するほうが検索精度的にも有利です。

**3. `.store_id` ファイルの自動読み込みを `buildConfig()` に組み込むと便利かも**

現在は `FILE_SEARCH_STORE_ID` を手動で `.env` に書く必要がありますが、
`.store_id` ファイルが存在すればそこから自動で読むようにすると、
CLI 実行時の運用がシンプルになります。

---

お疲れさまです。あとは全件アップロードが通れば完成ですね。頑張ってください！
