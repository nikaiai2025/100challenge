/**
 * 文豪キャラクター対話 — app.js
 *
 * 主な責務:
 *   1. works.json の読み込みと UI 初期化
 *   2. APIキーの localStorage 管理
 *   3. キャラクター／作品選択に応じた UI 連動
 *   4. Gemini API（SSEストリーミング）への問い合わせ
 *   5. 結果のマークダウンレンダリング（marked.js + DOMPurify）
 */

/* ===================================================
   定数
   =================================================== */

/** Gemini API エンドポイント（ストリーミング） */
const GEMINI_ENDPOINT =
	"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=";

/** localStorage に保存するキー */
const STORAGE_KEY_API = "gemini_api_key";

/** systemInstruction に付加する共通指示 */
const SYSTEM_INSTRUCTION_SUFFIX = `

回答はマークダウン形式で記述してください。前振りや挨拶は不要です。質問に対して直接回答してください。あなたはキャラクターとして振る舞い、キャラクターの口調・価値観で回答してください。`;

/* ===================================================
   アプリケーション状態
   =================================================== */

/** @type {{ characters: Array, templates: Array } | null} */
let worksData = null;

/** 現在ストリーミング中かどうか */
let isStreaming = false;

/* ===================================================
   DOM 参照（DOMContentLoaded 後に取得）
   =================================================== */

let elApiKeyInput,
	elSaveApiKeyBtn,
	elClearApiKeyBtn,
	elApiKeyStatus,
	elApiKeySection;
let elCharacterSelect, elWorkSelect, elWorkWarning;
let elTemplateSelect, elQueryTextarea;
let elSubmitBtn, elLoadingIndicator;
let elErrorMessage;
let elResultSection, elResultMeta, elResultContent;

/* ===================================================
   初期化
   =================================================== */

document.addEventListener("DOMContentLoaded", async () => {
	// DOM参照を取得
	elApiKeyInput = document.getElementById("api-key-input");
	elSaveApiKeyBtn = document.getElementById("save-api-key-btn");
	elClearApiKeyBtn = document.getElementById("clear-api-key-btn");
	elApiKeyStatus = document.getElementById("api-key-status");
	elApiKeySection = document.getElementById("api-key-section");
	elCharacterSelect = document.getElementById("character-select");
	elWorkSelect = document.getElementById("work-select");
	elWorkWarning = document.getElementById("work-warning");
	elTemplateSelect = document.getElementById("template-select");
	elQueryTextarea = document.getElementById("query-textarea");
	elSubmitBtn = document.getElementById("submit-btn");
	elLoadingIndicator = document.getElementById("loading-indicator");
	elErrorMessage = document.getElementById("error-message");
	elResultSection = document.getElementById("result-section");
	elResultMeta = document.getElementById("result-meta");
	elResultContent = document.getElementById("result-content");

	// marked.js オプション設定
	marked.setOptions({ breaks: true });

	// APIキー初期表示
	initApiKey();

	// works.json 読み込み
	try {
		worksData = await fetchJson("works.json");
		populateCharacterSelect(worksData.characters);
		populateWorkSelect(worksData.characters);
		populateTemplateSelect(worksData.templates);
	} catch (err) {
		showError("works.json の読み込みに失敗しました: " + err.message);
	}

	// イベントリスナー登録
	elSaveApiKeyBtn.addEventListener("click", saveApiKey);
	elClearApiKeyBtn.addEventListener("click", clearApiKey);
	elCharacterSelect.addEventListener("change", onCharacterChange);
	elWorkSelect.addEventListener("change", onWorkChange);
	elTemplateSelect.addEventListener("change", onTemplateChange);
	elSubmitBtn.addEventListener("click", onSubmit);

	// 送信可否の初期チェック
	updateSubmitState();
});

/* ===================================================
   APIキー管理
   =================================================== */

/**
 * APIキーの初期表示。
 * 保存済みの場合は入力欄にマスク表示し、ステータス表示。
 * 未設定の場合はカードを強調する。
 */
function initApiKey() {
	const saved = localStorage.getItem(STORAGE_KEY_API);
	if (saved) {
		// セキュリティ上、値をそのままinputに入れてユーザーが再送信できるようにする
		elApiKeyInput.value = saved;
		setApiKeyStatus("APIキーが保存されています", "is-saved");
		elApiKeySection.classList.remove("is-prominent");
	} else {
		setApiKeyStatus(
			"APIキーが未設定です。上記より設定してください。",
			"is-error",
		);
		elApiKeySection.classList.add("is-prominent");
	}
}

/** APIキーを localStorage に保存する */
function saveApiKey() {
	const key = elApiKeyInput.value.trim();
	if (!key) {
		setApiKeyStatus("APIキーを入力してください", "is-error");
		return;
	}
	if (!key.startsWith("AIza")) {
		setApiKeyStatus(
			"有効なGemini APIキーを入力してください（AIza...で始まる形式）",
			"is-error",
		);
		return;
	}
	localStorage.setItem(STORAGE_KEY_API, key);
	setApiKeyStatus("APIキーを保存しました", "is-saved");
	elApiKeySection.classList.remove("is-prominent");
	updateSubmitState();
}

/** APIキーを localStorage から削除する */
function clearApiKey() {
	localStorage.removeItem(STORAGE_KEY_API);
	elApiKeyInput.value = "";
	setApiKeyStatus("APIキーを削除しました", "is-cleared");
	elApiKeySection.classList.add("is-prominent");
	updateSubmitState();
}

/**
 * APIキーステータスを表示する
 * @param {string} message - 表示するメッセージ
 * @param {'is-saved' | 'is-error' | 'is-cleared'} cssClass - スタイルクラス
 */
function setApiKeyStatus(message, cssClass) {
	elApiKeyStatus.textContent = message;
	elApiKeyStatus.className = "api-key-status " + cssClass;
}

/* ===================================================
   セレクトボックス初期化
   =================================================== */

/**
 * キャラクター選択プルダウンを生成する
 * @param {Array} characters
 */
function populateCharacterSelect(characters) {
	characters.forEach((c) => {
		const opt = document.createElement("option");
		opt.value = c.id;
		opt.textContent = `${c.name}（${c.work}）`;
		elCharacterSelect.appendChild(opt);
	});
}

/**
 * 作品選択プルダウンを生成する
 * @param {Array} characters
 */
function populateWorkSelect(characters) {
	// 作品一覧は characters から取得（重複を排除しない、各キャラが対応する作品を1:1で持つ仕様）
	characters.forEach((c) => {
		const opt = document.createElement("option");
		opt.value = c.id; // キャラID を作品の識別子として利用
		opt.textContent = `${c.work}（${c.author}）`;
		elWorkSelect.appendChild(opt);
	});
}

/**
 * テンプレート選択プルダウンを生成する
 * @param {string[]} templates
 */
function populateTemplateSelect(templates) {
	templates.forEach((t) => {
		const opt = document.createElement("option");
		opt.value = t;
		opt.textContent = t;
		elTemplateSelect.appendChild(opt);
	});
}

/* ===================================================
   UI イベントハンドラー
   =================================================== */

/**
 * キャラクター変更時: 対応する作品を自動選択し、warning を表示する
 */
function onCharacterChange() {
	const charId = elCharacterSelect.value;
	if (!charId || !worksData) return;

	// 対応する作品を自動選択
	elWorkSelect.value = charId;
	onWorkChange();

	updateSubmitState();
}

/**
 * 作品変更時: warning 表示を更新する
 */
function onWorkChange() {
	const workId = elWorkSelect.value;
	if (!workId || !worksData) {
		elWorkWarning.textContent = "";
		return;
	}
	const character = worksData.characters.find((c) => c.id === workId);
	elWorkWarning.textContent = character?.warning ?? "";
	updateSubmitState();
}

/**
 * テンプレート選択時: テキストエリアにテンプレート文を反映する
 */
function onTemplateChange() {
	const val = elTemplateSelect.value;
	if (val) {
		elQueryTextarea.value = val;
		// 選択後はプルダウンをリセット（再選択可能にする）
		elTemplateSelect.value = "";
	}
	updateSubmitState();
}

/**
 * 送信ボタンの活性・非活性を更新する
 * 条件: APIキー保存済み、キャラ選択済み、作品選択済み、テキスト非空
 */
function updateSubmitState() {
	const hasApiKey = !!localStorage.getItem(STORAGE_KEY_API);
	const hasChar = !!elCharacterSelect?.value;
	const hasWork = !!elWorkSelect?.value;
	const hasQuery = !!elQueryTextarea?.value.trim();
	if (elSubmitBtn) {
		elSubmitBtn.disabled =
			!(hasApiKey && hasChar && hasWork && hasQuery) || isStreaming;
	}
}

// テキストエリア変更でも送信可否を再評価
document.addEventListener("DOMContentLoaded", () => {
	// DOMContentLoaded 後に登録（要素取得後）
	setTimeout(() => {
		elQueryTextarea?.addEventListener("input", updateSubmitState);
	}, 0);
});

/* ===================================================
   送信処理
   =================================================== */

/** 送信ボタンクリック時のメインハンドラー */
async function onSubmit() {
	if (isStreaming) return;

	hideError();
	clearResult();

	const apiKey = localStorage.getItem(STORAGE_KEY_API);
	const charId = elCharacterSelect.value;
	const workId = elWorkSelect.value;
	const queryText = elQueryTextarea.value.trim();

	// バリデーション
	if (!apiKey) {
		showError(
			"Gemini APIキーが設定されていません。ページ上部のAPIキー設定欄から保存してください。",
		);
		return;
	}
	if (!charId) {
		showError("キャラクターを選択してください。");
		return;
	}
	if (!workId) {
		showError("作品を選択してください。");
		return;
	}
	if (!queryText) {
		showError("質問文を入力してください。");
		return;
	}

	const character = worksData.characters.find((c) => c.id === charId);
	const workChar = worksData.characters.find((c) => c.id === workId);

	if (!character || !workChar) {
		showError("選択したキャラクターまたは作品の情報が見つかりません。");
		return;
	}

	setStreaming(true);

	try {
		// 人格プロンプトと作品テキストを並行取得
		const [promptText, workText] = await Promise.all([
			fetchText(character.promptFile),
			fetchText(workChar.textFile),
		]);

		// メタ情報を表示
		elResultMeta.textContent = `人格: ${character.name}（${character.work}）　読む作品: ${workChar.work}（${workChar.author}）`;
		elResultSection.hidden = false;
		elResultSection.scrollIntoView({ behavior: "smooth", block: "start" });

		// Gemini API 呼び出し（SSEストリーミング）
		await streamGeminiResponse(apiKey, promptText, workText, queryText);
	} catch (err) {
		showError(buildErrorMessage(err));
	} finally {
		setStreaming(false);
	}
}

/* ===================================================
   Gemini API 呼び出し
   =================================================== */

/**
 * Gemini API にSSEストリーミングでリクエストを送り、結果を逐次レンダリングする
 *
 * @param {string} apiKey
 * @param {string} promptText - 人格プロンプト本文
 * @param {string} workText   - 作品全文
 * @param {string} userQuery  - ユーザーの質問
 */
async function streamGeminiResponse(apiKey, promptText, workText, userQuery) {
	const systemInstruction = promptText + SYSTEM_INSTRUCTION_SUFFIX;

	const requestBody = {
		system_instruction: {
			parts: [{ text: systemInstruction }],
		},
		contents: [
			{
				role: "user",
				parts: [
					{
						text: `以下は作品の全文です。\n\n---\n${workText}\n---\n\n質問: ${userQuery}`,
					},
				],
			},
		],
		generationConfig: {
			temperature: 0.8,
			maxOutputTokens: 8192,
		},
	};

	const response = await fetch(GEMINI_ENDPOINT + encodeURIComponent(apiKey), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errBody = await response.text().catch(() => "");
		throw new ApiError(response.status, errBody);
	}

	// SSEストリームを読み取り、逐次レンダリング
	await readSseStream(response, (chunk) => {
		appendRawText(chunk);
	});
}

/**
 * SSEレスポンスのストリームを読み取り、テキストチャンクごとにコールバックを呼ぶ
 *
 * @param {Response} response - fetch レスポンス
 * @param {(text: string) => void} onChunk - チャンクテキストのコールバック
 */
async function readSseStream(response, onChunk) {
	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		// SSEは改行区切り。"data: {...}" 行を処理する
		const lines = buffer.split("\n");
		// 最後の行は未完かもしれないためバッファに残す
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;

			const jsonStr = trimmed.slice("data:".length).trim();
			if (jsonStr === "[DONE]") return;
			if (!jsonStr) continue;

			try {
				const parsed = JSON.parse(jsonStr);
				// Gemini のSSEレスポンス構造からテキストを抽出
				const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
				if (text) onChunk(text);
			} catch {
				// JSON パース失敗は無視（不完全なチャンクの可能性）
			}
		}
	}
}

/* ===================================================
   結果レンダリング
   =================================================== */

/** ストリーミング中に蓄積する生テキスト */
let rawTextBuffer = "";

/**
 * ストリーミングチャンクを追加し、Markdown をレンダリングする
 * @param {string} text
 */
function appendRawText(text) {
	rawTextBuffer += text;
	renderMarkdown(rawTextBuffer);
}

/**
 * Markdown テキストを DOMPurify 経由で安全にレンダリングする
 * @param {string} markdown
 */
function renderMarkdown(markdown) {
	const rawHtml = marked.parse(markdown);
	const cleanHtml = DOMPurify.sanitize(rawHtml);
	elResultContent.innerHTML = cleanHtml;
}

/** 結果エリアをクリアする */
function clearResult() {
	rawTextBuffer = "";
	elResultContent.innerHTML = "";
	elResultMeta.textContent = "";
	elResultSection.hidden = true;
}

/* ===================================================
   エラー処理
   =================================================== */

/** API エラーを表す独自クラス */
class ApiError extends Error {
	/**
	 * @param {number} status
	 * @param {string} body
	 */
	constructor(status, body) {
		super("API エラー: HTTP " + status);
		this.status = status;
		this.body = body;
	}
}

/**
 * エラーオブジェクトからユーザー向けメッセージを生成する
 * @param {unknown} err
 * @returns {string}
 */
function buildErrorMessage(err) {
	if (err instanceof ApiError) {
		if (err.status === 400)
			return "リクエストが不正です。入力内容をご確認ください。（HTTP 400）";
		if (err.status === 401 || err.status === 403)
			return (
				"APIキーが無効か権限がありません。APIキーを再確認してください。（HTTP " +
				err.status +
				"）"
			);
		if (err.status === 429)
			return "APIのレート制限に達しました。しばらく待ってから再試行してください。（HTTP 429）";
		if (err.status >= 500)
			return (
				"Gemini API サーバーでエラーが発生しました。しばらく後に再試行してください。（HTTP " +
				err.status +
				"）"
			);
		return "APIエラーが発生しました（HTTP " + err.status + "）";
	}
	if (err instanceof TypeError && err.message.includes("fetch")) {
		return "ネットワークエラーが発生しました。インターネット接続を確認してください。";
	}
	return String(err?.message ?? err ?? "不明なエラー");
}

/**
 * エラーメッセージを表示する
 * @param {string} message
 */
function showError(message) {
	elErrorMessage.textContent = message;
	elErrorMessage.hidden = false;
	elErrorMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** エラーメッセージを非表示にする */
function hideError() {
	elErrorMessage.textContent = "";
	elErrorMessage.hidden = true;
}

/* ===================================================
   ストリーミング状態管理
   =================================================== */

/**
 * ストリーミング中フラグをセットし、UI を更新する
 * @param {boolean} active
 */
function setStreaming(active) {
	isStreaming = active;
	elLoadingIndicator.hidden = !active;
	updateSubmitState();
}

/* ===================================================
   ユーティリティ
   =================================================== */

/**
 * JSON ファイルを fetch して解析する
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`${url} の取得に失敗しました（HTTP ${res.status}）`);
	return res.json();
}

/**
 * テキストファイルを fetch して文字列として返す
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`${url} の取得に失敗しました（HTTP ${res.status}）`);
	return res.text();
}
