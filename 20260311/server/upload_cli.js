const fs = require('fs');
const path = require('path');
const { buildConfig, uploadAll } = require('./upload_runner');

const writeStoreId = (baseDir, storeId) => {
  const target = path.resolve(baseDir, '.store_id');
  fs.writeFileSync(target, `${storeId}\n`, 'utf-8');
  console.log(`Store ID saved to ${target}`);
};

const main = async () => {
  const config = buildConfig();
  const result = await uploadAll(config);
  console.log(`Upload completed: ${result.count} files`);
  console.log(`Store ID: ${result.storeId}`);
  writeStoreId(config.baseDir, result.storeId);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
