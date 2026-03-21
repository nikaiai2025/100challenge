/**
 * build-data.mjs
 * 統合マークダウンファイル群を解析し、data.json を生成するスクリプト。
 *
 * 入力ファイル: 01_famous_copipe.md, 02_ascii_art.md, 03_good_stories.md,
 *               04_horror_occult.md, 05_net_slang.md, 06_culture_history.md
 * 出力ファイル: data.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// カテゴリ定義
// ---------------------------------------------------------------------------
const FILES = [
  { file: '01_famous_copipe.md', category: 'famous_copipe',   label: '有名コピペ' },
  { file: '02_ascii_art.md',     category: 'ascii_art',        label: 'AA（アスキーアート）' },
  { file: '03_good_stories.md',  category: 'good_stories',     label: 'いい話・感動' },
  { file: '04_horror_occult.md', category: 'horror_occult',    label: '怖い話・オカルト' },
  { file: '05_net_slang.md',     category: 'net_slang',        label: 'ネットスラング' },
  { file: '06_culture_history.md', category: 'culture_history', label: '文化論・歴史' },
];

// ---------------------------------------------------------------------------
// ユーティリティ: ID 生成
// ---------------------------------------------------------------------------
const usedIds = new Set();
// カテゴリごとの連番カウンタ
const categoryCounters = {};

function toId(title, category) {
  // タイトルから英数字のみ抽出してベース文字列を生成する。
  // 日本語タイトルで英数字が取れない場合は category + 連番を使う。
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);

  if (!base) {
    // 英数字がない場合: category_N 形式
    categoryCounters[category] = (categoryCounters[category] || 0) + 1;
    base = `${category}_${categoryCounters[category]}`;
  }

  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}_${n++}`;
  }
  usedIds.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// ユーティリティ: マークダウン → HTML 変換
// ---------------------------------------------------------------------------
function mdToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コードブロック (``` ... ```)
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const preLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        preLines.push(lines[i]);
        i++;
      }
      i++; // 閉じる ``` をスキップ
      const escaped = preLines.join('\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const cls = lang ? ` class="language-${lang}"` : '';
      result.push(`<pre><code${cls}>${escaped}</code></pre>`);
      continue;
    }

    // 引用ブロック (> ...)
    if (line.startsWith('>') || (line === '' && i + 1 < lines.length && lines[i + 1]?.startsWith('>'))) {
      // 連続する引用行を収集
      if (line.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && (lines[i].startsWith('>') || lines[i] === '')) {
          if (lines[i].startsWith('>')) {
            quoteLines.push(lines[i].slice(1).trimStart());
          } else {
            // 空行が続く場合は区切り
            if (quoteLines.length > 0 && quoteLines[quoteLines.length - 1] !== '') {
              quoteLines.push('');
            }
          }
          i++;
        }
        // 末尾の空行を除去
        while (quoteLines.length > 0 && quoteLines[quoteLines.length - 1] === '') {
          quoteLines.pop();
        }
        // 引用内の改行を <br> で連結
        const inner = quoteLines
          .map(l => escapeHtml(l))
          .join('<br>');
        result.push(`<blockquote>${inner}</blockquote>`);
        continue;
      }
    }

    // テーブル
    if (line.includes('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(renderTable(tableLines));
      continue;
    }

    // 見出し (### または ##)
    if (/^#{2,4}\s/.test(line)) {
      const level = line.match(/^(#{2,4})/)[1].length;
      const text = line.slice(level + 1).trim();
      result.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      i++;
      continue;
    }

    // リスト
    if (/^[-*]\s/.test(line)) {
      const listLines = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        listLines.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      const items = listLines.map(l => `<li>${inlineMarkdown(l)}</li>`).join('');
      result.push(`<ul>${items}</ul>`);
      continue;
    }

    // 番号付きリスト
    if (/^\d+\.\s/.test(line)) {
      const listLines = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listLines.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      const items = listLines.map(l => `<li>${inlineMarkdown(l)}</li>`).join('');
      result.push(`<ol>${items}</ol>`);
      continue;
    }

    // 水平線
    if (/^---+$/.test(line.trim())) {
      i++;
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 通常段落
    result.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }

  return result.join('\n');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    // **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // *italic* / _italic_
    .replace(/[*_](.+?)[*_]/g, '<em>$1</em>')
    // `code`
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // [text](url)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function renderTable(tableLines) {
  // ヘッダ行と区切り行とデータ行を分離
  const rows = tableLines.map(l => {
    // 前後の | を除去して分割
    return l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  });
  if (rows.length < 2) return '';

  const header = rows[0];
  // 2行目は区切り行 (---) なのでスキップ
  const dataRows = rows.slice(2);

  const ths = header.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = dataRows.map(row => {
    const tds = row.map(c => `<td>${inlineMarkdown(c)}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ---------------------------------------------------------------------------
// メタ情報抽出ヘルパー
// ---------------------------------------------------------------------------
function extractCount(lines) {
  for (const l of lines) {
    const m = l.match(/\*\*登場回数\*\*[：:]\s*(\d+)\/(\d+)/);
    if (m) return { count: parseInt(m[1]), maxCount: parseInt(m[2]) };
  }
  return { count: 0, maxCount: 15 };
}

function extractYear(lines) {
  for (const l of lines) {
    const m = l.match(/\*\*初出\*\*[：:]\s*(.+)/);
    if (m) return m[1].trim();
    const m2 = l.match(/\*\*初出\*\*.*?[:：]\s*(.+)/);
    if (m2) return m2[1].trim();
  }
  return '';
}

function extractSubcategory(lines) {
  for (const l of lines) {
    const m = l.match(/\*\*分類\*\*[：:]\s*(.+)/);
    if (m) return m[1].trim();
  }
  return '';
}

// ---------------------------------------------------------------------------
// 01_famous_copipe.md パーサー
// ---------------------------------------------------------------------------
function parseFamousCopipe(text, category) {
  const entries = [];
  // # セクション (ネタ系 / 煽り・論破系 / etc.) を subcat として使う
  let currentSubcat = '';

  const blocks = splitByHrule(text);

  for (const block of blocks) {
    const lines = block.split('\n');

    // # セクション見出し（## より浅い）
    const sectionLine = lines.find(l => /^# [^#]/.test(l));
    if (sectionLine && !lines.some(l => /^## /.test(l))) {
      currentSubcat = sectionLine.replace(/^# /, '').trim();
      continue;
    }

    // ## エントリ見出し
    const titleLine = lines.find(l => /^## /.test(l));
    if (!titleLine) continue;

    const title = titleLine.replace(/^## /, '').trim();

    // メタ情報（- **xxx**: value 行）
    const metaLines = lines.filter(l => /^- \*\*/.test(l));

    // サブカテゴリは分類フィールドを優先、なければ直近の # セクション
    const subcategory = extractSubcategory(metaLines) || currentSubcat;
    const { count, maxCount } = extractCount(metaLines);
    const year = extractYear(metaLines);

    // コンテンツ: メタ行・見出し行・区切りを除いた残り
    const contentLines = lines.filter(l =>
      !l.startsWith('## ') &&
      !l.startsWith('# ') &&
      !/^- \*\*(登場回数|分類|初出)\*\*/.test(l) &&
      !/^---/.test(l)
    );

    // ### 原文 / ### 内容 セクションと ### 出典・背景 セクションを分離
    const { content, background } = splitContentBackground(contentLines.join('\n'));

    entries.push({
      id: toId(title, category),
      category,
      subcategory,
      title,
      count,
      maxCount,
      year,
      content: mdToHtml(content.trim()),
      background: plainText(background.trim()),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 02_ascii_art.md パーサー
// ---------------------------------------------------------------------------
function parseAsciiArt(text, category) {
  const entries = [];

  // 「AA文化の歴史と概要」セクションを概要として1エントリ化
  const overviewMatch = text.match(/## AA文化の歴史と概要\n([\s\S]*?)(?=\n## 代表的AAキャラクター)/);
  if (overviewMatch) {
    const content = overviewMatch[1];
    entries.push({
      id: toId('aa_overview', category),
      category,
      subcategory: '文化概要',
      title: 'AA文化の歴史と概要',
      count: 0,
      maxCount: 15,
      year: '1999',
      content: mdToHtml(content.trim()),
      background: '',
    });
  }

  // 「代表的AAキャラクター」以降の ### エントリ
  const charSectionMatch = text.match(/## 代表的AAキャラクター\n([\s\S]*?)(?=\n## AA制作技術)/);
  if (charSectionMatch) {
    const charSection = charSectionMatch[1];
    parseAaCharacters(charSection, category, entries);
  }

  // 「AA制作技術」セクション
  const techMatch = text.match(/## AA制作技術\n([\s\S]*?)(?=\n## やる夫スレ文化|\n## Flash動画文化|$)/);
  if (techMatch) {
    entries.push({
      id: toId('aa_technique', category),
      category,
      subcategory: 'AA制作技術',
      title: 'AA制作技術',
      count: 0,
      maxCount: 15,
      year: '',
      content: mdToHtml(techMatch[1].trim()),
      background: '',
    });
  }

  // 「やる夫スレ文化」セクション
  const yaruoMatch = text.match(/## やる夫スレ文化\n([\s\S]*?)(?=\n## Flash動画文化|$)/);
  if (yaruoMatch) {
    entries.push({
      id: toId('yaruo_culture', category),
      category,
      subcategory: 'やる夫スレ文化',
      title: 'やる夫スレ文化',
      count: 0,
      maxCount: 15,
      year: '2007',
      content: mdToHtml(yaruoMatch[1].trim()),
      background: '',
    });
  }

  // 「Flash動画文化との連携」セクション
  const flashMatch = text.match(/## Flash動画文化との連携\n([\s\S]*?)$/);
  if (flashMatch) {
    entries.push({
      id: toId('flash_culture', category),
      category,
      subcategory: 'Flash動画文化',
      title: 'Flash動画文化との連携',
      count: 0,
      maxCount: 15,
      year: '2000',
      content: mdToHtml(flashMatch[1].trim()),
      background: '',
    });
  }

  return entries;
}

function parseAaCharacters(section, category, entries) {
  // --- で区切ってブロック分割
  const blocks = section.split(/\n---\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    const titleLine = lines.find(l => /^### /.test(l));
    if (!titleLine) continue;

    const title = titleLine.replace(/^### /, '').trim();

    // 登場回数
    const countLine = lines.find(l => /\*\*登場回数\*\*/.test(l));
    let count = 0, maxCount = 15;
    if (countLine) {
      const m = countLine.match(/(\d+)\/(\d+)/);
      if (m) { count = parseInt(m[1]); maxCount = parseInt(m[2]); }
    }

    // 年（テーブルから探す）
    let year = '';
    const yearLineInTable = section.match(new RegExp(`\\|.*${escapeRegex(title)}.*\\|`));
    if (yearLineInTable) {
      const m = yearLineInTable[0].match(/(\d{4})/);
      if (m) year = m[1];
    }

    // コンテンツ: 見出し行・登場回数行を除く残り
    const contentLines = lines.filter(l =>
      !l.startsWith('### ') &&
      !/\*\*登場回数\*\*/.test(l) &&
      !/^\s+-\s+claude_|^\s+-\s+gemini_|^\s+-\s+codex_/.test(l) && // ファイルリスト行除去
      !/^---/.test(l)
    );

    entries.push({
      id: toId(title, category),
      category,
      subcategory: 'AAキャラクター',
      title,
      count,
      maxCount,
      year,
      content: mdToHtml(contentLines.join('\n').trim()),
      background: '',
    });
  }
}

// ---------------------------------------------------------------------------
// 03_good_stories.md パーサー
// ---------------------------------------------------------------------------
function parseGoodStories(text, category) {
  const entries = [];
  let currentSubcat = '';

  const blocks = splitByHrule(text);

  for (const block of blocks) {
    const lines = block.split('\n');

    // ## サブカテゴリ見出し（### を持たない場合はサブカテゴリ変更）
    const h2 = lines.find(l => /^## /.test(l));
    const h3 = lines.find(l => /^### /.test(l));

    if (h2 && !h3) {
      currentSubcat = h2.replace(/^## /, '').trim();
      continue;
    }

    if (!h3) continue;

    const title = h3.replace(/^### /, '').trim();

    // サブカテゴリは直前の ## から取る
    if (h2) currentSubcat = h2.replace(/^## /, '').trim();

    // メタ情報
    const metaLines = lines.filter(l => /^- \*\*/.test(l));
    const { count, maxCount } = extractCount(metaLines);

    // 年（登場ファイルにある場合もあるが、初出がない場合は空）
    const year = extractYear(metaLines);

    // コンテンツ
    const contentLines = lines.filter(l =>
      !l.startsWith('## ') &&
      !l.startsWith('### ') &&
      !/^- \*\*(登場回数|登場ファイル|メディア展開)\*\*/.test(l) &&
      !/^---/.test(l)
    );

    entries.push({
      id: toId(title, category),
      category,
      subcategory: currentSubcat,
      title,
      count,
      maxCount,
      year,
      content: mdToHtml(contentLines.join('\n').trim()),
      background: '',
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 04_horror_occult.md パーサー
// ---------------------------------------------------------------------------
function parseHorrorOccult(text, category) {
  const entries = [];
  let currentSubcat = '';

  const blocks = splitByHrule(text);

  for (const block of blocks) {
    const lines = block.split('\n');

    const h2 = lines.find(l => /^## /.test(l));
    const h3 = lines.find(l => /^### /.test(l));

    // ## のみの場合はサブカテゴリ更新
    if (h2 && !h3) {
      currentSubcat = h2.replace(/^## /, '').trim();
      continue;
    }

    // エントリは ### または ## がある場合
    const titleLine = h3 || h2;
    if (!titleLine) continue;

    const title = (h3 || h2).replace(/^#{2,3}\s/, '').trim();
    if (h2 && h3) currentSubcat = h2.replace(/^## /, '').trim();

    // メタ情報
    const metaLines = lines.filter(l => /^- \*\*/.test(l));
    const { count, maxCount } = extractCount(metaLines);

    let year = '';
    for (const l of metaLines) {
      const m = l.match(/\*\*初出\*\*[：:]\s*(.+)/);
      if (m) { year = m[1].trim(); break; }
    }

    // コンテンツ
    // 「登場回数」「初出」「メディア展開」「著者」はメタ情報として除外する。
    // 「概要」行は - **概要**: テキスト 形式のため、<p> に変換して残す。
    const contentLines = lines.filter(l =>
      !l.startsWith('## ') &&
      !l.startsWith('### ') &&
      !/^- \*\*(登場回数|初出|メディア展開|著者)\*\*/.test(l) &&
      !/^---/.test(l)
    );

    // - **概要**: テキスト → <p>テキスト</p> に書き換え
    const processedContent = contentLines
      .map(l => {
        const m = l.match(/^- \*\*概要\*\*[：:]\s*(.+)/);
        if (m) return m[1].trim();
        return l;
      })
      .join('\n');

    entries.push({
      id: toId(title, category),
      category,
      subcategory: currentSubcat,
      title,
      count,
      maxCount,
      year,
      content: mdToHtml(processedContent.trim()),
      background: '',
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 05_net_slang.md パーサー
// ---------------------------------------------------------------------------
function parseNetSlang(text, category) {
  const entries = [];
  let currentSubcat = '';

  const blocks = splitByHrule(text);

  for (const block of blocks) {
    const lines = block.split('\n');

    const h2 = lines.find(l => /^## /.test(l));
    const h3 = lines.find(l => /^### /.test(l));

    // ## のみ = サブカテゴリ更新
    if (h2 && !h3) {
      currentSubcat = h2.replace(/^## /, '').trim();
      continue;
    }

    // ### がエントリ見出し
    if (!h3) continue;

    const title = h3.replace(/^### /, '').trim();
    if (h2) currentSubcat = h2.replace(/^## /, '').trim();

    // メタ情報
    const metaLines = lines.filter(l => /^- \*\*/.test(l));
    const { count, maxCount } = extractCount(metaLines);

    // スラングの初出はないので起源から年を拾う
    let year = '';
    for (const l of metaLines) {
      const m = l.match(/\*\*起源\*\*[：:]\s*.*?(\d{4})/);
      if (m) { year = m[1]; break; }
    }

    // コンテンツ（全メタ情報ラベル除く）
    const contentLines = lines.filter(l =>
      !l.startsWith('### ') &&
      !l.startsWith('## ') &&
      !/^- \*\*(登場回数|読み|意味|起源|用例|現在の状態)\*\*/.test(l) &&
      !/^---/.test(l)
    );

    // 意味・起源を structured に取り出してコンテンツ化
    const meaning = getMetaValue(metaLines, '意味');
    const origin  = getMetaValue(metaLines, '起源');
    const usage   = getMetaValue(metaLines, '用例');
    const status  = getMetaValue(metaLines, '現在の状態');
    const yomi    = getMetaValue(metaLines, '読み');

    let structuredContent = '';
    if (yomi)    structuredContent += `<p><strong>読み:</strong> ${escapeHtml(yomi)}</p>\n`;
    if (meaning) structuredContent += `<p><strong>意味:</strong> ${escapeHtml(meaning)}</p>\n`;
    if (origin)  structuredContent += `<p><strong>起源:</strong> ${escapeHtml(origin)}</p>\n`;
    if (usage)   structuredContent += `<p><strong>用例:</strong> <code>${escapeHtml(usage)}</code></p>\n`;
    if (status)  structuredContent += `<p><strong>現在の状態:</strong> ${escapeHtml(status)}</p>\n`;

    const extraContent = contentLines.join('\n').trim();
    const fullContent = structuredContent + (extraContent ? '\n' + mdToHtml(extraContent) : '');

    entries.push({
      id: toId(title, category),
      category,
      subcategory: currentSubcat,
      title,
      count,
      maxCount,
      year,
      content: fullContent.trim(),
      background: '',
    });
  }

  return entries;
}

function getMetaValue(lines, key) {
  for (const l of lines) {
    const re = new RegExp(`\\*\\*${key}\\*\\*[：:]\\s*(.+)`);
    const m = l.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

// ---------------------------------------------------------------------------
// 06_culture_history.md パーサー
// ---------------------------------------------------------------------------
function parseCultureHistory(text, category) {
  const entries = [];

  // ## で大セクション分割（### はサブエントリ or 本文中の見出し）
  // ファイル全体を ## で区切る
  const sectionRegex = /^## (.+)$/gm;
  const sectionMatches = [...text.matchAll(sectionRegex)];

  for (let si = 0; si < sectionMatches.length; si++) {
    const sectionTitle = sectionMatches[si][1].trim();
    const startIdx = sectionMatches[si].index + sectionMatches[si][0].length;
    const endIdx = si + 1 < sectionMatches.length ? sectionMatches[si + 1].index : text.length;
    const sectionBody = text.slice(startIdx, endIdx);

    // 言及ファイル数を抽出
    const countMatch = sectionBody.match(/\*\*言及ファイル数\*\*[：:]\s*(\d+)\/(\d+)/);
    const count    = countMatch ? parseInt(countMatch[1]) : 0;
    const maxCount = countMatch ? parseInt(countMatch[2]) : 15;

    // コンテンツ（言及ファイル数行を除く）
    const contentBody = sectionBody.replace(/^- \*\*言及ファイル数\*\*.*$/m, '').trim();

    entries.push({
      id: toId(sectionTitle, category),
      category,
      subcategory: '',
      title: sectionTitle,
      count,
      maxCount,
      year: '',
      content: mdToHtml(contentBody),
      background: '',
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

/** テキストを --- 行で分割してブロック配列を返す */
function splitByHrule(text) {
  return text.split(/\n---\n/).map(b => b.trim()).filter(b => b.length > 0);
}

/** マークダウンブロックを「原文・内容」と「出典・背景」に分離する */
function splitContentBackground(text) {
  // ### 出典・背景 / ### 背景 で分割を試みる
  const splitRe = /###\s*(出典[・・]?背景|背景|出典)/;
  const idx = text.search(splitRe);
  if (idx === -1) {
    return { content: text, background: '' };
  }
  const content = text.slice(0, idx);
  const bgSection = text.slice(idx);
  // ### 見出し行自体は除去
  const background = bgSection.replace(splitRe, '').trim();
  return { content, background };
}

/** HTML タグ除去して平文にする */
function plainText(html) {
  // まずマークダウンのリスト記法だけプレーンテキスト化
  return html
    .replace(/^- /gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
function main() {
  const allEntries = [];

  for (const { file, category } of FILES) {
    const filePath = join(__dirname, file);
    const text = readFileSync(filePath, 'utf-8');

    let entries = [];
    switch (category) {
      case 'famous_copipe':
        entries = parseFamousCopipe(text, category);
        break;
      case 'ascii_art':
        entries = parseAsciiArt(text, category);
        break;
      case 'good_stories':
        entries = parseGoodStories(text, category);
        break;
      case 'horror_occult':
        entries = parseHorrorOccult(text, category);
        break;
      case 'net_slang':
        entries = parseNetSlang(text, category);
        break;
      case 'culture_history':
        entries = parseCultureHistory(text, category);
        break;
    }

    console.log(`[${file}] → ${entries.length} エントリ`);
    allEntries.push(...entries);
  }

  const outputPath = join(__dirname, 'data.json');
  writeFileSync(outputPath, JSON.stringify(allEntries, null, 2), 'utf-8');

  console.log('\n=== サマリー ===');
  const byCategory = {};
  for (const e of allEntries) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }
  for (const [cat, cnt] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${cnt} エントリ`);
  }
  console.log(`  ─────────────`);
  console.log(`  合計: ${allEntries.length} エントリ`);
  console.log(`\n出力: ${outputPath}`);
}

main();
