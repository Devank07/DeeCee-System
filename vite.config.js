import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git folder */ }
const built = new Date().toISOString();
const info = { version: pkg.version, commit, built };

// Writes dist/version.json so open apps can notice a newer deploy
const versionFile = () => ({
  name: 'version-file',
  apply: 'build',
  writeBundle(opts) {
    const dir = opts.dir || 'dist';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/version.json`, JSON.stringify(info));
  },
});

export default defineConfig({
  plugins: [react(), versionFile()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(info) },
  build: {
    chunkSizeWarningLimit: 1500,
    // Two pages: the Company OS (index.html) and the public client gallery (gallery.html → /gallery)
    rollupOptions: { input: { main: 'index.html', gallery: 'gallery.html' } },
  },
});
