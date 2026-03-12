const fs = require('fs');
const path = require('path');

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

const loadFixedDb = (filePath) => {
  if (!fs.existsSync(filePath)) return new Map();
  const rows = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).filter(Boolean);
  const map = new Map();
  rows.forEach((line) => {
    const raw = JSON.parse(line);
    const fileName = raw.file_name || raw.fileName || '';
    const title = fileName.replace(/\.txt$/i, '').trim();
    const docId = raw.doc_id || raw.docId || '';
    if (!docId) return;
    map.set(docId, {
      title,
      author: raw['著者名'] || raw.author || '',
    });
  });
  return map;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parsePages = (text) => {
  const lines = text.split(/\r?\n/);
  const pages = [];
  const metaRegex = /^DOC_ID:([^|]+)\s*\|\s*PAGE:(\d+)\s*\|\s*LINES:([0-9-]+)/i;
  let current = null;

  const flush = () => {
    if (!current) return;
    pages.push({
      docId: current.docId,
      pageNo: current.pageNo,
      lineRange: current.lineRange,
      lines: current.lines,
    });
  };

  for (const line of lines) {
    const match = line.match(metaRegex);
    if (match) {
      flush();
      current = {
        docId: match[1].trim(),
        pageNo: Number(match[2]),
        lineRange: match[3].trim(),
        lines: [line],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return pages;
};

const buildHtml = ({ title, author, docId, pageNo, lineRange, lines }) => {
  const metaLine = `DOC_ID:${docId} | PAGE:${pageNo} | LINES:${lineRange}`;
  const bodyLines = [metaLine, ...lines.filter((line) => !line.startsWith('DOC_ID:'))];
  const content = bodyLines.map((line) => escapeHtml(line)).join('<br>');
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - p.${pageNo}</title>
  </head>
  <body data-pagefind-body>
    <h1 data-pagefind-meta="title">${escapeHtml(title)}</h1>
    <p data-pagefind-meta="author">${escapeHtml(author)}</p>
    <span data-pagefind-meta="doc_id" hidden>${escapeHtml(docId)}</span>
    <span data-pagefind-meta="page" hidden>${pageNo}</span>
    <span data-pagefind-meta="line_range" hidden>${escapeHtml(lineRange)}</span>
    <article>${content}</article>
  </body>
</html>`;
};

const main = () => {
  const sourceDir = process.env.AOZORA_PREPROCESSED_DIR || path.resolve(__dirname, '..', 'Aozora_Texts_Preprocessed');
  const fixedDbPath = process.env.FIXED_DB_PATH || path.resolve(__dirname, '..', 'doc_id_map.jsonl');
  const outputDir = process.env.PAGEFIND_PAGES_DIR || path.resolve(__dirname, '..', 'pages');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`対象フォルダが見つかりません: ${sourceDir}`);
  }

  const fixedMap = loadFixedDb(fixedDbPath);
  const files = collectTxtFiles(sourceDir);
  if (!files.length) {
    console.log('対象 .txt が見つかりません。');
    return;
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  let total = 0;
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf-8');
    const pages = parsePages(text);
    pages.forEach((page) => {
      const fixed = fixedMap.get(page.docId) || {};
      const title = fixed.title || page.docId;
      const author = fixed.author || '不明';
      const docDir = path.join(outputDir, page.docId);
      fs.mkdirSync(docDir, { recursive: true });
      const pageFile = path.join(docDir, `page-${String(page.pageNo).padStart(4, '0')}.html`);
      const html = buildHtml({
        title,
        author,
        docId: page.docId,
        pageNo: page.pageNo,
        lineRange: page.lineRange,
        lines: page.lines,
      });
      fs.writeFileSync(pageFile, html, 'utf-8');
      total += 1;
    });
  }

  console.log(`ページ生成完了: ${total}件`);
  console.log('次に `npx -y pagefind --site 20260311` を実行してください。');
};

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
