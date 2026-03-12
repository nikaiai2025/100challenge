const fs = require('fs');
const path = require('path');

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

const collectTxtFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTxtFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      files.push(full);
    }
  }
  return files;
};

const extractDocIdFromFileName = (filePath) => {
  const base = path.basename(filePath).replace(/\.[^/.]+$/, '');
  const match = base.match(/^[a-z0-9-]+/i);
  return match ? match[0] : base;
};

const pollOperation = async (name, apiKey, apiBase) => {
  const cleaned = name.startsWith('operations/') ? name : `operations/${name}`;
  const endpoint = `${apiBase.replace(/\/$/, '')}/${cleaned}?key=${encodeURIComponent(apiKey)}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(endpoint);
    const data = await response.json();
    console.log('Operation status', data);
    if (data.done) return data;
    await sleep(2000);
  }
  return null;
};

const uploadFile = async ({ apiKey, storeName, uploadBase, apiBase }, filePath) => {
  const fileText = fs.readFileSync(filePath, 'utf-8');
  const docId = extractDocIdFromFileName(filePath);
  const boundary = `----codex-${Math.random().toString(16).slice(2)}`;
  const metadata = {
    displayName: path.basename(filePath),
    mimeType: 'text/plain',
    customMetadata: [
      { key: 'doc_id', stringValue: docId },
      { key: 'file_name', stringValue: path.basename(filePath) },
    ],
  };

  const body = [
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n',
    `--${boundary}\r\n`,
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n',
    fileText,
    '\r\n',
    `--${boundary}--`,
  ].join('');

  const endpoint = `${uploadBase.replace(/\/$/, '')}/fileSearchStores/${storeName}:uploadToFileSearchStore?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  console.log('Upload response', data);
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Upload failed: ${response.status}`);
  }
  if (data.name) {
    await pollOperation(data.name, apiKey, apiBase);
  }
};

const main = async () => {
  resolveEnv();
  if (typeof fetch !== 'function') {
    throw new Error('Node.js 18+ が必要です (fetch 未対応)。');
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const storeName = process.env.FILE_SEARCH_STORE || process.env.GEMINI_FILE_SEARCH_STORE;
  const apiBase = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
  const uploadBase = process.env.GEMINI_UPLOAD_BASE || 'https://generativelanguage.googleapis.com/upload/v1beta';
  const sourceDir = process.env.AOZORA_PREPROCESSED_DIR || path.resolve(__dirname, '..', 'Aozora_Texts_Preprocessed');
  const delayMs = Number(process.env.UPLOAD_DELAY_MS || '1200');

  if (!apiKey || !storeName) {
    throw new Error('GEMINI_API_KEY と FILE_SEARCH_STORE を設定してください。');
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`対象フォルダが見つかりません: ${sourceDir}`);
  }

  const files = collectTxtFiles(sourceDir);
  if (!files.length) {
    console.log('アップロード対象の .txt が見つかりません。');
    return;
  }

  console.log(`対象ファイル: ${files.length}件`);
  for (let i = 0; i < files.length; i += 1) {
    const filePath = files[i];
    console.log(`[${i + 1}/${files.length}] Uploading: ${path.basename(filePath)}`);
    await uploadFile({ apiKey, storeName, uploadBase, apiBase }, filePath);
    if (delayMs > 0) await sleep(delayMs);
  }
  console.log('アップロード完了');
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
