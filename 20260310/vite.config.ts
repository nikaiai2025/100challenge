import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ command }) => {
  const envConfig: Record<string, string> = {};

  // Only inject environment variables locally during 'npm run dev'
  if (command === 'serve') {
    const envPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const val = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
          envConfig[`process.env.${key.trim()}`] = JSON.stringify(val);
        }
      });
    }
  } else {
    // For production build, ensure process.env exists but is empty
    // Keys will be fetched via BYOK (localStorage)
    envConfig['process.env'] = JSON.stringify({});
  }

  return {
    plugins: [react()],
    base: './', // For GitHub Pages / static hosting
    define: {
      ...envConfig,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || (command === 'serve' ? 'development' : 'production'))
    }
  };
});
