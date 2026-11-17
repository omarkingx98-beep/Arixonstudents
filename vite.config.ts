import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function collectShellFiles(dirPath: string, rootDir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return acc;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectShellFiles(fullPath, rootDir, acc);
    } else if (entry.isFile()) {
      const rel = '/' + path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (rel === '/sw.js' || rel.endsWith('.map') || rel.startsWith('/assets/aistudio/')) continue;
      if (
        rel === '/index.html' ||
        rel.startsWith('/assets/') ||
        rel.startsWith('/icons/') ||
        /^\/(manifest\.webmanifest|manifest\.json|favicon\.ico|favicon-\d+x\d+\.png|apple-touch-icon\.png)$/.test(rel)
      ) {
        acc.push(rel);
      }
    }
  }
  return acc;
}

function arixonSwPrecachePlugin(): Plugin {
  return {
    name: 'arixon-sw-precache',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const assets = Array.from(new Set(['/', ...collectShellFiles(distDir, distDir)])).sort();
      const hash = crypto.createHash('sha256');
      for (const relPath of assets) {
        hash.update(relPath);
        if (relPath === '/') continue;
        const abs = path.join(distDir, relPath.replace(/^\//, ''));
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          hash.update(fs.readFileSync(abs));
        }
      }
      const cacheVersion = `arixon-shell-${hash.digest('hex').slice(0, 12)}`;

      let swCode = fs.readFileSync(swPath, 'utf8');
      swCode = swCode.replace(/__CACHE_VERSION__/g, cacheVersion);
      swCode = swCode.replace('[/*__PRECACHE_MANIFEST__*/]', JSON.stringify(assets));
      fs.writeFileSync(swPath, swCode, 'utf8');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), arixonSwPrecachePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
