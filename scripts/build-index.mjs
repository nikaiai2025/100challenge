import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let outPath = path.resolve(repoRoot, 'index.html');
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--out' && args[i + 1]) {
    outPath = path.resolve(repoRoot, args[i + 1]);
    i += 1;
  }
}

const dateDirPattern = /^\d{8}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateFromDir(dirName) {
  const y = dirName.slice(0, 4);
  const m = dirName.slice(4, 6);
  const d = dirName.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const projects = fs
  .readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && dateDirPattern.test(entry.name))
  .map((entry) => {
    const dirName = entry.name;
    const dirPath = path.join(repoRoot, dirName);
    const metaPath = path.join(dirPath, 'project.json');
    const packagePath = path.join(dirPath, 'package.json');

    const meta = readJsonIfExists(metaPath) || {};
    const pkg = readJsonIfExists(packagePath) || {};

    const date = formatDateFromDir(dirName);
    const title = meta.title || meta.name || pkg.name || date;
    const description = meta.description || pkg.description || 'No description yet.';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    return {
      dirName,
      date,
      title,
      description,
      tags,
    };
  })
  .sort((a, b) => b.dirName.localeCompare(a.dirName));

const lastUpdated = projects.length ? projects[0].date : '';

const cardsHtml = projects
  .map((project) => {
    const tagHtml = project.tags.length
      ? `<span class="card-tag">${escapeHtml(project.tags.join(' / '))}</span>`
      : '';
    return `
            <a class="card" href="./${escapeHtml(project.dirName)}/">
                <span class="card-date">${escapeHtml(project.date)}</span>
                <span class="card-title">${escapeHtml(project.title)}</span>
                <span class="card-desc">${escapeHtml(project.description)}</span>
                ${tagHtml}
                <span class="card-arrow">&rarr;</span>
            </a>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>100 Challenge Projects</title>
  <meta name="description" content="100-day challenge project index" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --bg: #f5f5f7;
      --surface: #ffffff;
      --border: #e5e5e7;
      --text: #1d1d1f;
      --muted: #6e6e73;
      --accent: #1d1d1f;
      --accent2: #6e6e73;
      --shadow: 0 18px 45px rgba(0, 0, 0, 0.08);
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 4rem 2rem 6rem;
    }

    .hero {
      margin-bottom: 4rem;
    }

    .hero-eyebrow {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1rem;
    }

    .hero h1 {
      font-size: clamp(2.2rem, 6vw, 3.5rem);
      font-weight: 800;
      line-height: 1.1;
      color: var(--text);
      margin-bottom: 1.25rem;
    }

    .hero p {
      font-size: 1.1rem;
      color: var(--muted);
      max-width: 560px;
      line-height: 1.7;
    }

    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1.25rem;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.75rem;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.02));
      opacity: 0;
      transition: opacity 0.25s;
    }

    .card:hover {
      border-color: #d1d1d6;
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .card:hover::before {
      opacity: 1;
    }

    .card-date {
      font-size: 0.75rem;
      color: var(--muted);
      font-weight: 500;
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .card-desc {
      font-size: 0.875rem;
      color: var(--muted);
      line-height: 1.6;
      flex: 1;
    }

    .card-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      background: #f2f2f4;
      color: var(--muted);
      width: fit-content;
      letter-spacing: 0.03em;
    }

    .card-arrow {
      font-size: 1rem;
      color: var(--text);
      margin-top: auto;
      opacity: 0;
      transform: translateX(-4px);
      transition: all 0.2s ease;
    }

    .card:hover .card-arrow {
      opacity: 1;
      transform: translateX(0);
    }

    footer {
      margin-top: 5rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--muted);
    }
  </style>
</head>

<body>
  <div class="container">
    <section class="hero">
      <p class="hero-eyebrow">Projects</p>
      <h1>100 Challenge</h1>
      <p>A growing index of daily builds. Add a new date folder and this page updates automatically.</p>
    </section>

    <p class="section-label">${escapeHtml(projects.length ? `Last updated ${lastUpdated}` : 'No projects yet')}</p>
    <div class="cards">
${cardsHtml || '      <p>No projects found.</p>'}
    </div>

    <footer>
      <p>Built with curiosity &middot; 2026</p>
    </footer>
  </div>
</body>

</html>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

console.log(`Wrote ${outPath}`);
