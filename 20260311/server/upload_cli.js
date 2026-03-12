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
  try {
    const result = await uploadAll(config);
    console.log(`Upload completed: ${result.count} files`);
    console.log(`Store ID: ${result.storeId}`);
    if (result.failed && result.failed.length > 0) {
      console.log(`Failed uploads: ${result.failed.length}`);
    }
    writeStoreId(config.baseDir, result.storeId);
  } finally {
    console.log('Upload run finished.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
