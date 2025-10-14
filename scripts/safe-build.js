#!/usr/bin/env node
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

function isProdHtml() {
  try {
    const html = readFileSync('index.html', 'utf8');
    return html.includes('/assets/') || html.includes('/ansuz/assets/');
  } catch {
    return false;
  }
}

if (isProdHtml()) {
  console.log('index.html appears to be production (assets refs found). Skipping vite build.');
  process.exit(0);
}

const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, ROLLUP_DISABLE_NATIVE: '1' }
});
process.exit(res.status || 0);

