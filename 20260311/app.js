const PAGE_SIZE = 10;
const MAX_RESULTS = 50;

const state = {
  fixedDb: [],
  fixedById: new Map(),
  docIdByFileName: new Map(),
  results: {
    fulltext: [],
    fileSearch: [],
    federation: [],
    rag: [],
  },
  pages: {
    fulltext: 1,
    fileSearch: 1,
    federation: 1,
    rag: 1,
  },
  loading: {
    fulltext: false,
    fileSearch: false,
    federation: false,
    rag: false,
  },
};

const elements = {
  queryInput: document.getElementById('queryInput'),
  searchBtn: document.getElementById('searchBtn'),
  clearBtn: document.getElementById('clearBtn'),
  globalStatus: document.getElementById('globalStatus'),
  yearFrom: document.getElementById('yearFrom'),
  yearTo: document.getElementById('yearTo'),
  authorFilter: document.getElementById('authorFilter'),
  genreFilter: document.getElementById('genreFilter'),
  geminiKey: document.getElementById('geminiKey'),
  geminiModel: document.getElementById('geminiModel'),
  geminiEndpointLabel: document.getElementById('geminiEndpointLabel'),
  saveGeminiBtn: document.getElementById('saveGeminiBtn'),
  clearGeminiBtn: document.getElementById('clearGeminiBtn'),
  settingsToggle: document.getElementById('settingsToggle'),
  configPanel: document.getElementById('configPanel'),
  storeIdInput: document.getElementById('storeIdInput'),
  storeBaseLabel: document.getElementById('storeBaseLabel'),
  uploadBaseLabel: document.getElementById('uploadBaseLabel'),
  storeStatusBtn: document.getElementById('storeStatusBtn'),
  storeIdDisplay: document.getElementById('storeIdDisplay'),
  storeStatus: document.getElementById('storeStatus'),
  federationFilterBtn: document.getElementById('federationFilterBtn'),
  federationFilterModal: document.getElementById('federationFilterModal'),
  federationFilterBackdrop: document.getElementById('federationFilterBackdrop'),
  federationFilterClose: document.getElementById('federationFilterClose'),
  textModal: document.getElementById('textModal'),
  textModalBackdrop: document.getElementById('textModalBackdrop'),
  textModalClose: document.getElementById('textModalClose'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
};

const storageKeys = {
  geminiKey: 'aozora_gemini_key',
  geminiModel: 'aozora_gemini_model',
  storeId: 'aozora_store_id',
};

const defaults = {
  geminiModel: 'gemini-3-flash-preview',
  geminiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  storeBase: 'https://generativelanguage.googleapis.com/v1beta',
  uploadBase: 'https://generativelanguage.googleapis.com/upload/v1beta',
};

let pagefindInstance = null;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const setStatus = (message, isError = false) => {
  elements.globalStatus.textContent = message;
  elements.globalStatus.classList.toggle('error', isError);
};

const setStoreStatus = (message, isError = false) => {
  if (!elements.storeStatus) return;
  elements.storeStatus.textContent = message;
  elements.storeStatus.classList.toggle('error', isError);
};

const loadSetting = (key, fallback = '') => {
  const value = localStorage.getItem(key);
  return value !== null ? value : fallback;
};

const saveSetting = (key, value) => {
  if (!value) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
};

const getStoreId = () => loadSetting(storageKeys.storeId, '');
const setStoreId = (value) => saveSetting(storageKeys.storeId, value);

function renderStoreIdDisplay() {
  if (!elements.storeIdDisplay) return;
  const storeId = getStoreConfig().storeId;
  elements.storeIdDisplay.textContent = storeId ? `Store ID: ${storeId}` : 'Store ID: 未設定';
}

const setSettingsVisibility = (visible) => {
  if (!elements.configPanel || !elements.settingsToggle) return;
  elements.configPanel.classList.toggle('is-hidden', !visible);
  elements.settingsToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
  elements.settingsToggle.textContent = visible ? '⚙ 設定を閉じる' : '⚙ 設定';
};

const initSettings = () => {
  elements.geminiKey.value = loadSetting(storageKeys.geminiKey, '');
  elements.geminiModel.value = loadSetting(storageKeys.geminiModel, defaults.geminiModel);
  if (elements.geminiEndpointLabel) {
    elements.geminiEndpointLabel.textContent = defaults.geminiEndpoint;
  }
  if (elements.storeIdInput) {
    elements.storeIdInput.value = loadSetting(storageKeys.storeId, '');
  }
  if (elements.storeBaseLabel) {
    elements.storeBaseLabel.textContent = defaults.storeBase;
  }
  if (elements.uploadBaseLabel) {
    elements.uploadBaseLabel.textContent = defaults.uploadBase;
  }
  renderStoreIdDisplay();
  const initialVisible = elements.configPanel ? !elements.configPanel.classList.contains('is-hidden') : false;
  setSettingsVisibility(initialVisible);
};

const isLocalRun = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname || '';
  return LOCAL_HOSTS.has(host) || window.location?.protocol === 'file:';
};

const parseEnv = (text) => {
  const env = {};
  text.split(/\r?\n/).forEach((line) => {
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
    env[key] = value;
  });
  return env;
};

const loadLocalEnvKey = async () => {
  if (!isLocalRun()) return;
  if (elements.geminiKey.value) return;

  const candidates = ['./.env', '../.env'];
  for (const path of candidates) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) continue;
      const text = await response.text();
      const env = parseEnv(text);
      if (env.GEMINI_API_KEY) {
        elements.geminiKey.value = env.GEMINI_API_KEY;
        setStatus('ローカル .env から GEMINI_API_KEY を読み込みました。');
        return;
      }
    } catch (error) {
      // Ignore local env fetch errors to keep production behavior unchanged.
    }
  }
};

const loadLocalStoreId = async () => {
  if (!isLocalRun()) return;
  try {
    const response = await fetch('./.store_id', { cache: 'no-store' });
    if (!response.ok) return;
    const text = await response.text();
    const storeId = text.trim();
    if (storeId) {
      const current = getStoreIdValue();
      if (current !== storeId) {
        setStoreId(storeId);
        if (elements.storeIdInput) {
          elements.storeIdInput.value = storeId;
        }
        renderStoreIdDisplay();
        setStoreStatus('Store ID を同期しました。');
      }
    }
  } catch {
    // ignore
  }
};

const truncate = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
};

const stripHtml = (value) => {
  if (!value) return '';
  return String(value).replace(/<[^>]*>/g, '');
};

const parseDocPageFromText = (text) => {
  if (!text) return { docId: '', page: '' };
  const docMatch = text.match(/DOC_ID:([a-z0-9-]+)/i);
  const pageMatch = text.match(/PAGE:(\d+)/i);
  return {
    docId: docMatch ? docMatch[1] : '',
    page: pageMatch ? pageMatch[1] : '',
  };
};

const cleanSnippet = (text) => {
  if (!text) return '';
  const stripped = text.replace(/^DOC_ID:.*(\r?\n|$)/i, '').trim();
  const normalized = stripped.replace(/\s+/g, ' ');
  return truncate(normalized, 200);
};

const normalizeFullText = (text) => {
  if (!text) return '';
  return String(text).replace(/\r?\n{3,}/g, '\n\n').trim();
};

const getCustomMetadataValue = (items, key) => {
  if (!Array.isArray(items)) return '';
  const hit = items.find((item) => item?.key === key);
  if (!hit) return '';
  if (typeof hit.stringValue === 'string') return hit.stringValue;
  if (typeof hit.numericValue === 'number') return String(hit.numericValue);
  if (hit.stringListValue?.values?.length) return hit.stringListValue.values.join(',');
  return '';
};

const extractMeta = (text, chunk = {}) => {
  let docId = '';
  let page = '';

  if (typeof text === 'string') {
    const docMatch = text.match(/DOC_ID:([a-z0-9-]+)/i);
    const pageMatch = text.match(/PAGE:(\d+)/i);
    docId = docMatch ? docMatch[1] : '';
    page = pageMatch ? pageMatch[1] : '';
  }

  if (!docId) {
    docId = chunk.documentId || chunk.document_id || '';
    if (!docId && chunk.document?.name) {
      const parts = String(chunk.document.name).split('/');
      docId = parts[parts.length - 1] || '';
    }
  }
  if (!docId) {
    const meta = chunk.document?.customMetadata;
    docId =
      getCustomMetadataValue(meta, 'doc_id') ||
      getCustomMetadataValue(meta, 'book_id') ||
      getCustomMetadataValue(meta, 'docId') ||
      '';
  }

  return { docId, page };
};

const extractChunkText = (chunk) => {
  if (!chunk) return '';
  if (typeof chunk === 'string') return chunk;
  const context = chunk.retrievedContext || chunk.retrievalContext || chunk.context || chunk.retrieved_context;
  if (typeof context === 'string') return context;
  if (context?.text) return context.text;
  if (Array.isArray(context?.parts)) {
    return context.parts.map(part => part.text || '').join('');
  }
  if (chunk.text) return chunk.text;
  if (chunk.content) return chunk.content;
  return '';
};

const extractChunks = (payload) => {
  const chunks = [];
  const visited = new Set();

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;

    if (Array.isArray(node.groundingChunks)) {
      node.groundingChunks.forEach((chunk) => {
        if (!chunk) return;
        const key = JSON.stringify(chunk);
        if (visited.has(key)) return;
        visited.add(key);
        chunks.push(chunk);
      });
    }

    Object.values(node).forEach(walk);
  };

  walk(payload);
  return chunks;
};

const mapFixedDb = (items, fileMap) => {
  state.fixedDb = items;
  state.fixedById = new Map();
  state.docIdByFileName = fileMap;
  items.forEach((item) => {
    state.fixedById.set(item.bookId, item);
  });
};

const loadFixedDb = async () => {
  try {
    const response = await fetch('./doc_id_map.jsonl');
    if (!response.ok) {
      throw new Error(`固定DB読み込み失敗: ${response.status}`);
    }
    const text = await response.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const fileMap = new Map();
    const items = rows.map((line) => {
      const raw = JSON.parse(line);
      const fileName = raw.file_name || raw.fileName || '';
      if (fileName && (raw.doc_id || raw.book_id || raw.docId)) {
        fileMap.set(fileName, raw.doc_id || raw.book_id || raw.docId);
      }
      const title = fileName.replace(/\.txt$/i, '').trim();
      return {
        bookId: raw.doc_id || raw.book_id || raw.docId || '',
        fileName,
        title,
        author: raw['著者名'] || raw.author || raw.author_name || '',
        year: raw['発行年'] || raw.year || '',
        genre: raw['ジャンル'] || raw.genre || '',
      };
    });
    mapFixedDb(items, fileMap);
    console.log(`固定DB読み込み完了: ${items.length}件`);
  } catch (error) {
    console.error(error);
    setStatus('固定DBの読み込みに失敗しました。', true);
  }
};

const initPagefind = async () => {
  if (pagefindInstance) return pagefindInstance;
  try {
    const module = await import('./pagefind/pagefind.js');
    if (module?.options) {
      await module.options({ bundlePath: './pagefind/' });
    }
    if (module?.init) {
      await module.init();
    }
    pagefindInstance = module;
    return module;
  } catch (error) {
    throw new Error('Pagefind インデックスが見つかりません。事前に pagefind を生成してください。');
  }
};

const getGeminiConfig = () => {
  const apiKey = elements.geminiKey.value.trim();
  const model = elements.geminiModel.value.trim() || defaults.geminiModel;
  const endpointTemplate = defaults.geminiEndpoint;
  const endpoint = endpointTemplate.includes('{model}')
    ? endpointTemplate.replace('{model}', encodeURIComponent(model))
    : endpointTemplate;
  return { apiKey, model, endpoint };
};

const getStoreIdValue = () => {
  const value = elements.storeIdInput?.value?.trim();
  return value || getStoreId();
};

const normalizeStoreValue = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return { storeId: '', resourceName: '' };
  }
  const parts = trimmed.split('/');
  const storeId = parts[parts.length - 1] || trimmed;
  const resourceName = trimmed.startsWith('fileSearchStores/')
    ? trimmed
    : `fileSearchStores/${storeId}`;
  return { storeId, resourceName };
};

const getStoreConfig = () => {
  const storedValue = getStoreIdValue();
  const normalized = normalizeStoreValue(storedValue);
  return {
    storeId: normalized.storeId,
    resourceName: normalized.resourceName,
    base: defaults.storeBase,
    uploadBase: defaults.uploadBase,
  };
};

const requireStoreIdIfLocal = () => {
  if (isLocalRun() && !getStoreConfig().storeId) {
    throw new Error('Store ID が未設定です。');
  }
};

const renderColumn = (kind) => {
  const results = state.results[kind] || [];
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(state.pages[kind], totalPages);
  state.pages[kind] = page;

  const list = document.querySelector(`[data-results="${kind}"]`);
  list.innerHTML = '';

  const meta = document.getElementById(`${kind}Meta`);
  if (meta) meta.textContent = `${total}件`;

  const pagination = document.getElementById(`${kind}Pagination`);
  if (pagination) {
    const info = pagination.querySelector('.page-info');
    if (info) info.textContent = `${page} / ${totalPages}`;
    const prevBtn = pagination.querySelector('[data-action="prev"]');
    const nextBtn = pagination.querySelector('[data-action="next"]');
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
  }

  if (state.loading[kind]) {
    const loading = document.createElement('div');
    loading.className = 'empty-state loading';
    loading.textContent = '検索中...';
    list.appendChild(loading);
    return;
  }

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '結果がありません。';
    list.appendChild(empty);
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  const slice = results.slice(start, start + PAGE_SIZE);
  slice.forEach((result, index) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.kind = kind;
    card.dataset.index = String(start + index);
    card.addEventListener('click', () => {
      const fullText = result.fullText || result.rawText || result.snippet || '';
      const kindLabel = {
        fulltext: '全文検索',
        fileSearch: 'セマンティック検索',
        federation: 'フェデレーション',
        rag: 'RAG',
      }[kind] || kind;
      const title = result.title ? `${result.title}（${kindLabel}）` : '本文';
      openTextModal(title, fullText);
    });

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = result.title || '不明';

    card.appendChild(title);

    if (kind !== 'rag') {
      const author = document.createElement('div');
      author.className = 'result-author';
      author.textContent = result.author || '不明';

      const row = document.createElement('div');
      row.className = 'result-row';
      const rowLabel = document.createElement('span');
      rowLabel.textContent = 'ページ';
      const rowValue = document.createElement('span');
      rowValue.textContent = result.pageLabel || '位置不明';
      row.appendChild(rowLabel);
      row.appendChild(rowValue);

      card.appendChild(author);
      card.appendChild(row);
    }

    if (result.docId) {
      const tag = document.createElement('div');
      tag.className = 'result-tag';
      tag.textContent = `DOC_ID: ${result.docId}`;
      card.appendChild(tag);
    }

    const snippet = document.createElement('div');
    snippet.className = 'result-snippet';
    snippet.textContent = result.snippet || 'スニペットが取得できません。';
    card.appendChild(snippet);

    list.appendChild(card);
  });
};

const renderAll = () => {
  renderColumn('fulltext');
  renderColumn('fileSearch');
  renderColumn('federation');
  renderColumn('rag');
};

const resetPages = () => {
  state.pages.fulltext = 1;
  state.pages.fileSearch = 1;
  state.pages.federation = 1;
  state.pages.rag = 1;
};

const buildPagefindResults = (dataList) => {
  return dataList.slice(0, MAX_RESULTS).map((item) => {
    const meta = item.meta || {};
    let docId = meta.doc_id || meta.docId || '';
    let page = meta.page || meta.page_no || '';

    if (!docId || !page) {
      const parsed = parseDocPageFromText(item.content || item.excerpt || '');
      if (!docId) docId = parsed.docId;
      if (!page) page = parsed.page;
    }

    const fixed = docId ? state.fixedById.get(docId) : null;
    const title = meta.title || fixed?.title || '不明';
    const author = meta.author || fixed?.author || '不明';
    const fullText = stripHtml(item.content || item.excerpt || '');
    return {
      title,
      author,
      pageLabel: page ? `p.${page}` : '位置不明',
      snippet: cleanSnippet(stripHtml(item.excerpt || item.content || '')) || 'スニペットが取得できません。',
      docId: docId || '',
      fullText: normalizeFullText(fullText),
    };
  });
};

const searchPagefind = async (query) => {
  const pagefind = await initPagefind();
  const search = await pagefind.search(query);
  const results = await Promise.all(search.results.slice(0, MAX_RESULTS).map((item) => item.data()));
  console.log('Pagefind response', results);
  return buildPagefindResults(results);
};

const buildFileSearchResults = (payload) => {
  const chunks = extractChunks(payload);
  const results = chunks.map((chunk) => {
    const text = extractChunkText(chunk);
    const meta = extractMeta(text, chunk);
    const fixed = meta.docId ? state.fixedById.get(meta.docId) : null;
    const title = fixed?.title || chunk.title || '不明';
    const author = fixed?.author || '不明';
    const pageLabel = meta.page ? `p.${meta.page} (推定)` : '位置不明';
    return {
      title,
      author,
      pageLabel,
      snippet: cleanSnippet(text) || 'スニペットが取得できません。',
      docId: meta.docId || '',
      rawText: text,
      fullText: normalizeFullText(text),
    };
  });
  return results.filter(result => result.snippet).slice(0, MAX_RESULTS);
};

const searchFileSearch = async (query) => {
  const config = getGeminiConfig();
  if (!config.apiKey) {
    throw new Error('Gemini APIキーを設定してください。');
  }
  requireStoreIdIfLocal();
  const store = getStoreConfig().resourceName;
  if (!store) {
    throw new Error('Store ID を設定してください。');
  }

  const systemInstruction = {
    parts: [
      {
        text: [
          'You MUST use the file_search tool to answer.',
          'Use only the retrieved context; do not answer from prior knowledge.',
          'If no grounded results are found, respond exactly with: NO_RESULT.',
        ].join(' '),
      },
    ],
  };

  const payload = {
    systemInstruction,
    contents: [{ parts: [{ text: query }] }],
    generationConfig: { temperature: 0 },
    tools: [{ file_search: { file_search_store_names: [store] } }],
  };

  const response = await fetch(`${config.endpoint}?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  console.log('File Search response', JSON.stringify(data, null, 2));
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `File Search Error ${response.status}`);
  }
  return data;
};

const getFederationFilter = () => {
  const yearFrom = parseInt(elements.yearFrom.value, 10);
  const yearTo = parseInt(elements.yearTo.value, 10);
  const author = elements.authorFilter.value.trim();
  const genre = elements.genreFilter.value.trim();

  return (item) => {
    if (Number.isFinite(yearFrom) && item.year && Number(item.year) < yearFrom) return false;
    if (Number.isFinite(yearTo) && item.year && Number(item.year) > yearTo) return false;
    if (author && item.author && !item.author.includes(author)) return false;
    if (genre && item.genre !== genre) return false;
    return true;
  };
};

const buildFederationResults = (fileSearchResults) => {
  const filter = getFederationFilter();
  const allowedIds = new Set(state.fixedDb.filter(filter).map(item => item.bookId));
  return fileSearchResults
    .filter(result => result.docId && allowedIds.has(result.docId))
    .map((result) => {
      const fixed = state.fixedById.get(result.docId);
      return {
        ...result,
        title: fixed?.title || result.title,
        author: fixed?.author || result.author,
        pageLabel: result.pageLabel || '位置不明',
      };
    })
    .slice(0, MAX_RESULTS);
};

const extractCandidateText = (payload) => {
  const candidate = payload?.candidates?.[0];
  if (!candidate) return '';
  const content = candidate.content || {};
  if (Array.isArray(content.parts)) {
    return content.parts.map((part) => part.text || '').join('');
  }
  if (typeof content.text === 'string') return content.text;
  return '';
};

const buildRagResults = (payload) => {
  const text = normalizeFullText(extractCandidateText(payload));
  if (!text) return [];
  return [
    {
      title: 'RAG回答',
      author: '',
      pageLabel: '',
      snippet: cleanSnippet(text),
      fullText: text,
    },
  ];
};

const isAnyModalOpen = () => {
  const textOpen = elements.textModal && !elements.textModal.classList.contains('is-hidden');
  const filterOpen =
    elements.federationFilterModal &&
    !elements.federationFilterModal.classList.contains('is-hidden');
  return Boolean(textOpen || filterOpen);
};

const syncModalState = () => {
  document.body.classList.toggle('modal-open', isAnyModalOpen());
};

const openTextModal = (title, text) => {
  if (!elements.textModal || !elements.modalBody || !elements.modalTitle) return;
  elements.modalTitle.textContent = title || '本文';
  elements.modalBody.textContent = text || '本文がありません。';
  elements.textModal.classList.remove('is-hidden');
  syncModalState();
};

const closeTextModal = () => {
  if (!elements.textModal) return;
  elements.textModal.classList.add('is-hidden');
  syncModalState();
};

const openFilterModal = () => {
  if (!elements.federationFilterModal) return;
  elements.federationFilterModal.classList.remove('is-hidden');
  if (elements.federationFilterBtn) {
    elements.federationFilterBtn.setAttribute('aria-expanded', 'true');
  }
  syncModalState();
};

const closeFilterModal = () => {
  if (!elements.federationFilterModal) return;
  elements.federationFilterModal.classList.add('is-hidden');
  if (elements.federationFilterBtn) {
    elements.federationFilterBtn.setAttribute('aria-expanded', 'false');
  }
  syncModalState();
};

let summarySections = null;

const loadSummarySections = async () => {
  if (summarySections) return summarySections;
  const response = await fetch('./research/まとめ.md', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('まとめ.md が見つかりません。');
  }
  const text = await response.text();
  const sections = new Map();
  text
    .split(/^##\s+/m)
    .map(part => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [titleLine, ...rest] = part.split(/\r?\n/);
      const title = titleLine.trim();
      const body = rest.join('\n').trim();
      if (title) {
        sections.set(title, body);
      }
    });
  summarySections = sections;
  return sections;
};

const openSummarySection = async (title) => {
  try {
    const sections = await loadSummarySections();
    const body = sections.get(title);
    if (!body) {
      throw new Error(`まとめ.md に「${title}」の節が見つかりません。`);
    }
    openTextModal(title, body);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'まとめ.md の読み込みに失敗しました。', true);
  }
};

const runSearch = async () => {
  const query = elements.queryInput.value.trim();
  if (!query) {
    setStatus('検索クエリを入力してください。', true);
    return;
  }

  setStatus('検索中...');
  state.loading.fulltext = true;
  state.loading.fileSearch = true;
  state.loading.federation = true;
  state.loading.rag = true;
  resetPages();
  renderAll();

  const pagefindPromise = searchPagefind(query).catch((error) => ({ error }));
  const fileSearchPromise = searchFileSearch(query).catch((error) => ({ error }));

  const [pagefindResult, fileSearchPayload] = await Promise.all([pagefindPromise, fileSearchPromise]);

  if (pagefindResult?.error) {
    console.error(pagefindResult.error);
    state.results.fulltext = [];
  } else {
    state.results.fulltext = pagefindResult || [];
  }
  state.loading.fulltext = false;

  let fileSearchResults = [];
  let ragResults = [];
  if (fileSearchPayload?.error) {
    console.error(fileSearchPayload.error);
    fileSearchResults = [];
    ragResults = [];
  } else {
    fileSearchResults = buildFileSearchResults(fileSearchPayload);
    ragResults = buildRagResults(fileSearchPayload);
  }
  state.results.fileSearch = fileSearchResults;
  state.loading.fileSearch = false;

  state.results.federation = buildFederationResults(fileSearchResults);
  state.loading.federation = false;

  state.results.rag = ragResults;
  state.loading.rag = false;

  renderAll();
  if (pagefindResult?.error || fileSearchPayload?.error) {
    setStatus('検索エラーが発生しました。コンソールを確認してください。', true);
  } else {
    setStatus(`検索完了: ${query}`);
  }
};

const clearResults = () => {
  state.results.fulltext = [];
  state.results.fileSearch = [];
  state.results.federation = [];
  resetPages();
  renderAll();
  setStatus('クリアしました。');
};

const handlePagination = (event) => {
  const action = event.target?.dataset?.action;
  if (!action) return;
  const column = event.currentTarget.closest('.result-column');
  if (!column) return;
  const kind = column.dataset.kind;
  if (!kind) return;

  const total = state.results[kind].length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (action === 'prev') {
    state.pages[kind] = Math.max(1, state.pages[kind] - 1);
  }
  if (action === 'next') {
    state.pages[kind] = Math.min(totalPages, state.pages[kind] + 1);
  }
  renderColumn(kind);
};

const checkStoreStatus = async () => {
  const storeId = getStoreConfig().storeId;
  if (!storeId) {
    setStatus('Store ID が未設定です。', true);
    setStoreStatus('未確認', false);
    return;
  }

  setStatus('Store状態を確認中...');
  setStoreStatus('確認中...', false);

  const checkViaApi = async (apiKey) => {
    const endpoint = `${defaults.storeBase.replace(/\/$/, '')}/fileSearchStores/${storeId}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint);
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }
    console.log('Store status response', data);

    if (response.ok) {
      const name = data.name ? data.name.split('/').pop() : storeId;
      const display = data.displayName || name;
      setStoreStatus(`存在: ${display}`);
      setStatus('Store状態を取得しました。');
      return;
    }

    if (response.status === 404 || data.error?.status === 'NOT_FOUND') {
      setStoreStatus('存在しません', true);
      setStatus('Storeが見つかりません。', true);
      return;
    }

    setStoreStatus('確認失敗', true);
    setStatus(data.error?.message || data.message || 'Store状態の確認に失敗しました。', true);
  };

  const { apiKey } = getGeminiConfig();
  if (!apiKey) {
    setStatus('APIキーを入力してください。', true);
    setStoreStatus('未確認', false);
    return;
  }
  await checkViaApi(apiKey);
};

const bindEvents = () => {
  elements.searchBtn.addEventListener('click', runSearch);
  elements.clearBtn.addEventListener('click', clearResults);
  elements.queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });

  elements.saveGeminiBtn.addEventListener('click', () => {
    saveSetting(storageKeys.geminiKey, elements.geminiKey.value.trim());
    saveSetting(storageKeys.geminiModel, elements.geminiModel.value.trim());
    setStatus('Gemini設定を保存しました。');
  });

  elements.clearGeminiBtn.addEventListener('click', () => {
    elements.geminiKey.value = '';
    saveSetting(storageKeys.geminiKey, '');
    setStatus('Gemini APIキーを削除しました。');
  });

  document.querySelectorAll('[data-summary]').forEach((button) => {
    button.addEventListener('click', () => {
      const title = button.dataset.summary;
      if (title) {
        openSummarySection(title);
      }
    });
  });

  if (elements.settingsToggle) {
    elements.settingsToggle.addEventListener('click', () => {
      const isHidden = elements.configPanel?.classList.contains('is-hidden');
      setSettingsVisibility(Boolean(isHidden));
    });
  }

  elements.storeStatusBtn.addEventListener('click', checkStoreStatus);
  if (elements.storeIdInput) {
    elements.storeIdInput.addEventListener('change', () => {
      const value = elements.storeIdInput.value.trim();
      setStoreId(value);
      renderStoreIdDisplay();
      setStoreStatus(value ? 'Store ID を保存しました。' : '未設定', !value);
    });
  }

  if (elements.textModalBackdrop) {
    elements.textModalBackdrop.addEventListener('click', closeTextModal);
  }
  if (elements.textModalClose) {
    elements.textModalClose.addEventListener('click', closeTextModal);
  }
  if (elements.federationFilterBtn) {
    elements.federationFilterBtn.addEventListener('click', openFilterModal);
  }
  if (elements.federationFilterBackdrop) {
    elements.federationFilterBackdrop.addEventListener('click', closeFilterModal);
  }
  if (elements.federationFilterClose) {
    elements.federationFilterClose.addEventListener('click', closeFilterModal);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeFilterModal();
    closeTextModal();
  });

  document.querySelectorAll('.pagination').forEach((pagination) => {
    pagination.addEventListener('click', handlePagination);
  });
};

const init = async () => {
  initSettings();
  await loadLocalEnvKey();
  await loadLocalStoreId();
  bindEvents();
  renderAll();
  await loadFixedDb();
};

init();
