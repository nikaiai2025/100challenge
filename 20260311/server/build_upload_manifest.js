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

const main = () => {
  const baseDir = path.resolve(__dirname, '..');
  const sourceDir = process.env.AOZORA_PREPROCESSED_DIR || path.join(baseDir, 'Aozora_Texts_Preprocessed');
  const outputPath = process.env.UPLOAD_MANIFEST_PATH || path.join(baseDir, 'upload_manifest.json');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`対象フォルダが見つかりません: ${sourceDir}`);
  }

  const files = collectTxtFiles(sourceDir);
  const list = files.map((filePath) => {
    const relative = path.relative(baseDir, filePath).replace(/\\/g, '/');
    return {
      path: `./${relative}`,
      fileName: path.basename(filePath),
    };
  });

  fs.writeFileSync(outputPath, JSON.stringify(list, null, 2), 'utf-8');
  console.log(`upload_manifest.json 生成完了: ${list.length}件`);
};

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
