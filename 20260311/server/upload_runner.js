const fs = require('fs');
const path = require('path');

// Upload runner for Gemini File Search Store.
// Purpose: provide a deterministic, debuggable CLI/runner that uploads local text files
// and lets us tweak retry/chunking behavior while investigating API-side failures.
// 目的（何をやろうとしているか）:
// - Aozora_Texts_Preprocessed の各テキストを File Search Store に登録し、
//   セマンティック検索のインデックス（Store）を作る。
// - 実運用前に、長文・日本語テキストでの失敗要因（503, token count）を特定し、
//   再試行/分割/短縮などの戦略を検証する。
//
// References (official):
// - File Search Store API: https://ai.google.dev/api/file-search/file-search-stores
// - File Search guide (chunkingConfig examples): https://ai.google.dev/gemini-api/docs/file-search
//
// Observed errors during real uploads (for expert review):
// - "Failed to count tokens." on full-length JP texts (~145KB).
// - 503 errors from uploadToFileSearchStore on long files.
// - Small truncated samples (2,000 chars) upload successfully.
//
// KNOWN ISSUES / 検証メモ（有識者向け）
// 1) 503 が連続する
//   - 特に長文（例: こころ.txt）で 503 が多発。
//   - shouldRetry() 対象のため再試行するが、3回で失敗終了。
//   - API 側混雑の可能性が高い。時間帯を変えるか分割/短縮が必要かもしれない。
//
// 2) "Failed to count tokens."
//   - 4xx 系で返ることが多く、shouldRetry() には含めていないため即失敗。
//   - CHUNK_TOKENS を下げる、テキスト分割などの回避が必要。
//
// 3) Windows の文字化け（UPLOAD_TEST_FILE）
//   - cmd.exe 経由で起動すると、日本語パスが化けて
//     UPLOAD_TEST_FILE が正しく渡らないことがある。
//   - この場合、uploadTestFile が空扱いになり manifest の先頭を読みに行き、
//     ログに「縺薙％繧・txt」などの文字化けが出る。
//   - 推奨: PowerShell から UTF-8 出力を固定して起動する。
//     例:
//       [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
//       $OutputEncoding = [System.Text.Encoding]::UTF8
//       $env:UPLOAD_TEST_FILE = 'C:\\...\\こころ.txt'
//       node upload_cli.js > log.txt 2>&1
//
// 4) クライアント側タイムアウト
//   - 長時間かかる前提のため、UPLOAD_REQUEST_TIMEOUT_MS は 0（無効）が推奨。
//   - 途中で AbortError になると 503 と区別がつかず、原因調査が難しくなる。
const DISPLAY_STORE_NAME = 'aozora-100-store';

const loadDotEnv = (envPath) => {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

const resolveEnv = () => {
  loadDotEnv(path.resolve(__dirname, '.env'));
  loadDotEnv(path.resolve(__dirname, '..', '.env'));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options, timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return await fetch(url, options);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// Retry for transient server failures (observed 503) and throttling.
const shouldRetry = (status) => {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

const loadDocIdMap = (docIdMapPath) => {
  const map = new Map();
  if (!fs.existsSync(docIdMapPath)) return map;
  const content = fs.readFileSync(docIdMapPath, 'utf-8');
  content.split(/\r?\n/).filter(Boolean).forEach((line) => {
    try {
      const row = JSON.parse(line);
      const fileName = row.file_name || row.fileName || '';
      const docId = row.doc_id || row.book_id || row.docId || '';
      if (fileName && docId) {
        map.set(fileName, docId);
      }
    } catch {
      // ignore invalid lines
    }
  });
  return map;
};

const loadManifest = (manifestPath, sourceDir) => {
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }
  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith('.txt'))
    .map((file) => ({
      path: `./Aozora_Texts_Preprocessed/${file}`,
      fileName: file,
    }));
  return files;
};

// Operations polling is optional; some API responses may return empty JSON or non-JSON.
const pollOperation = async (
  name,
  apiBase,
  apiKey,
  pollIntervalMs,
  pollMaxAttempts,
  requestTimeoutMs,
) => {
  // name is e.g. "fileSearchStores/xxx/upload/operations/yyy" - use as-is as the path segment.
  // Previously was incorrectly prepending "operations/" which doubled the prefix.
  const endpoint = `${apiBase.replace(/\/$/, '')}/${name}?key=${encodeURIComponent(apiKey)}`;
  for (let attempt = 0; attempt < pollMaxAttempts; attempt += 1) {
    const response = await fetchWithTimeout(endpoint, {}, requestTimeoutMs);
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }
    if (data.done) return data;
    await sleep(pollIntervalMs);
  }
  return null;
};

// Create a new File Search Store with a display name; returns storeId in response.name.
const createStore = async ({ apiBase, apiKey, requestTimeoutMs }) => {
  const endpoint = `${apiBase.replace(/\/$/, '')}/fileSearchStores?key=${encodeURIComponent(apiKey)}`;
  const payload = { displayName: DISPLAY_STORE_NAME };
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    requestTimeoutMs,
  );
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to create store.');
  }
  return data;
};

// Upload a single file to File Search Store using multipart/related per API docs.
// Note: "Failed to count tokens." has been observed on long JP texts.
// If this recurs, consider lowering CHUNK_TOKENS or splitting files before upload.
const uploadOne = async (config, entry, docIdMap) => {
  const filePath = typeof entry === 'string' ? entry : entry.path;
  const fileName = typeof entry === 'string' ? path.basename(entry) : entry.fileName;
  if (!filePath || !fileName) return;

  const resolved = path.resolve(config.baseDir, filePath);
  let fileText = fs.readFileSync(resolved, 'utf-8');
  if (config.uploadTruncateChars > 0 && fileText.length > config.uploadTruncateChars) {
    fileText = fileText.slice(0, config.uploadTruncateChars);
  }
  const docIdFromMap = docIdMap.get(fileName);
  const docId =
    docIdFromMap ||
    path.basename(fileName).replace(/\.[^/.]+$/, '').match(/^[a-z0-9-]+/i)?.[0] ||
    '';

  // Metadata schema: displayName/mimeType/customMetadata + chunkingConfig.
  // We use whiteSpaceConfig (maxTokensPerChunk, maxOverlapTokens) per docs.
  const metadata = {
    displayName: fileName,
    mimeType: 'text/plain',
    customMetadata: [
      { key: 'doc_id', stringValue: docId },
      { key: 'file_name', stringValue: fileName },
    ],
    chunkingConfig: {
      whiteSpaceConfig: {
        maxTokensPerChunk: config.chunkTokens,
        maxOverlapTokens: config.chunkOverlap,
      },
    },
  };

  const boundary = `----codex-${Math.random().toString(16).slice(2)}`;
  const chunks = [
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n',
    'Content-Disposition: form-data; name="metadata"\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n',
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n',
    fileText,
    '\r\n',
    `--${boundary}--`,
  ];
  const body = chunks.join('');
  const bodyBuffer = Buffer.from(body, 'utf-8');

  const endpoint = `${config.uploadBase.replace(/\/$/, '')}/fileSearchStores/${config.storeId}:uploadToFileSearchStore?key=${encodeURIComponent(config.apiKey)}`;

  let lastError = null;
  for (let attempt = 1; attempt <= config.retryMax; attempt += 1) {
    if (attempt === 1) {
      console.log(`Uploading: ${fileName}`);
    } else {
      console.log(`Retry ${attempt}/${config.retryMax}: ${fileName}`);
    }
    let response;
    let raw = '';
    let data = {};
    try {
      response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length.toString(),
          },
          body: bodyBuffer,
        },
        config.requestTimeoutMs,
      );
      raw = await response.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }
    } catch (error) {
      lastError = error;
      const waitMs = config.retryBaseMs * Math.pow(2, attempt - 1);
      console.warn(
        `Request failed for ${fileName}. ${error?.name || 'Error'}: ${error?.message || error}.`,
      );
      if (attempt >= config.retryMax) {
        break;
      }
      console.warn(`Waiting ${waitMs}ms before retry.`);
      await sleep(waitMs);
      continue;
    }

    if (response.ok) {
      if (data.name) {
        await pollOperation(
          data.name,
          config.apiBase,
          config.apiKey,
          config.pollIntervalMs,
          config.pollMaxAttempts,
          config.requestTimeoutMs,
        );
      }
      console.log(`Uploaded: ${fileName}`);
      return;
    }

    // Known errors from API:
    // - "Failed to count tokens." (tokenizer/chunking failure)
    // - 503 (service unavailable)
    const message = data.error?.message || data.message || raw || `Upload failed: ${response.status}`;
    lastError = new Error(message);

    if (!shouldRetry(response.status) || attempt >= config.retryMax) {
      break;
    }
    const waitMs = config.retryBaseMs * Math.pow(2, attempt - 1);
    console.warn(
      `Retryable error (${response.status}) for ${fileName}. Waiting ${waitMs}ms.`,
    );
    await sleep(waitMs);
  }

  console.error(`Upload failed: ${fileName}`);
  throw new Error(`Upload failed for ${fileName}: ${lastError?.message || 'Unknown error'}`);
};

// Build config from .env with safe defaults for retries/chunking.
// Tuning knobs: CHUNK_TOKENS/CHUNK_OVERLAP, UPLOAD_DELAY_MS, UPLOAD_RETRY_*.
const buildConfig = () => {
  resolveEnv();
  const baseDir = path.resolve(__dirname, '..');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiBase = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
  const uploadBase = process.env.GEMINI_UPLOAD_BASE || 'https://generativelanguage.googleapis.com/upload/v1beta';
  const manifestPath = process.env.UPLOAD_MANIFEST_PATH || path.resolve(baseDir, 'upload_manifest.json');
  const sourceDir = process.env.AOZORA_PREPROCESSED_DIR || path.resolve(baseDir, 'Aozora_Texts_Preprocessed');
  const docIdMapPath = process.env.FIXED_DB_PATH || path.resolve(baseDir, 'doc_id_map.jsonl');
  const delayMs = Number(process.env.UPLOAD_DELAY_MS || '1200');
  const retryMax = Number(process.env.UPLOAD_RETRY_MAX || '3');
  const retryBaseMs = Number(process.env.UPLOAD_RETRY_BASE_MS || '1000');
  const uploadLimit = Number(process.env.UPLOAD_LIMIT || '0');
  const uploadOffset = Number(process.env.UPLOAD_OFFSET || '0');
  const uploadTestFile = process.env.UPLOAD_TEST_FILE || '';
  const uploadTruncateChars = Number(process.env.UPLOAD_TRUNCATE_CHARS || '0');
  const chunkTokens = Number(process.env.CHUNK_TOKENS || '400');
  const chunkOverlap = Number(process.env.CHUNK_OVERLAP || '40');
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || '2000');
  const pollMaxAttempts = Number(process.env.POLL_MAX_ATTEMPTS || '60');
  const requestTimeoutMs = Number(process.env.UPLOAD_REQUEST_TIMEOUT_MS || '0');
  const continueOnError =
    String(process.env.UPLOAD_CONTINUE_ON_ERROR || '').toLowerCase() === '1' ||
    String(process.env.UPLOAD_CONTINUE_ON_ERROR || '').toLowerCase() === 'true';
  const failureManifestPath =
    process.env.UPLOAD_FAILURE_MANIFEST_PATH || path.resolve(baseDir, 'upload_manifest_failed.json');
  const storeId =
    process.env.FILE_SEARCH_STORE_ID ||
    process.env.FILE_SEARCH_STORE ||
    process.env.GEMINI_FILE_SEARCH_STORE ||
    '';

  return {
    baseDir,
    apiKey,
    apiBase,
    uploadBase,
    manifestPath,
    sourceDir,
    docIdMapPath,
    delayMs,
    retryMax,
    retryBaseMs,
    uploadLimit,
    uploadOffset,
    uploadTestFile,
    uploadTruncateChars,
    chunkTokens,
    chunkOverlap,
    pollIntervalMs,
    pollMaxAttempts,
    requestTimeoutMs,
    continueOnError,
    failureManifestPath,
    storeId,
  };
};

// Upload all items in manifest (or a test file / limit).
const uploadAll = async (config) => {
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  let storeId = config.storeId;
  let created = null;
  if (!storeId) {
    created = await createStore({
      apiBase: config.apiBase,
      apiKey: config.apiKey,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    storeId = created.name ? created.name.split('/').pop() : '';
  }
  if (!storeId) {
    throw new Error('Store ID could not be resolved.');
  }

  let manifest = loadManifest(config.manifestPath, config.sourceDir);
  if (!manifest.length) {
    throw new Error('No files found in manifest.');
  }
  if (config.uploadTestFile) {
    manifest = [
      {
        path: config.uploadTestFile,
        fileName: path.basename(config.uploadTestFile),
      },
    ];
  }
  if (config.uploadOffset > 0) {
    manifest = manifest.slice(config.uploadOffset);
  }
  if (config.uploadLimit > 0) {
    manifest = manifest.slice(0, config.uploadLimit);
  }

  const docIdMap = loadDocIdMap(config.docIdMapPath);
  const runConfig = { ...config, storeId };
  const failed = [];

  for (let i = 0; i < manifest.length; i += 1) {
    try {
      const entry = manifest[i];
      const entryName = typeof entry === 'string' ? path.basename(entry) : entry.fileName;
      console.log(`File ${i + 1}/${manifest.length}: ${entryName}`);
      await uploadOne(runConfig, entry, docIdMap);
    } catch (error) {
      failed.push({
        entry: manifest[i],
        message: error?.message || String(error),
      });
      console.error(error);
      if (!config.continueOnError) {
        throw error;
      }
    }
    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  if (failed.length > 0) {
    try {
      const remaining = failed.map((item) => item.entry);
      fs.writeFileSync(config.failureManifestPath, JSON.stringify(remaining, null, 2), 'utf-8');
      console.log(
        'Failure manifest saved: ' +
          config.failureManifestPath +
          ' (' +
          remaining.length +
          ' files)',
      );
    } catch (error) {
      console.error('Failed to write failure manifest:', error);
    }
  }

  return { count: manifest.length, storeId, created, failed };
};

module.exports = {
  buildConfig,
  uploadAll,
  createStore,
  loadManifest,
  loadDocIdMap,
};

