import { copyFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying ANSUZ dist build to repository root for GitHub Pages (main/root)...');

const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

try {
  if (!existsSync(distDir)) {
    throw new Error('dist directory not found. Run "vite build" first.');
  }

  // Clean conflicting root artifacts
  try { rmSync(join(rootDir, 'assets'), { recursive: true, force: true }); } catch {}
  try { rmSync(join(rootDir, 'index.css'), { force: true }); } catch {}
  try { rmSync(join(rootDir, 'index.tsx'), { force: true }); } catch {}

  // Copy index.html to root
  copyFileSync(join(distDir, 'index.html'), join(rootDir, 'index.html'));
  console.log('✔ Copied index.html to root');

  // Copy all entries (files and folders) from dist to root
  const entries = readdirSync(distDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(distDir, entry.name);
    const destPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
      console.log(`✔ Copied directory: ${entry.name}`);
    } else if (entry.isFile() && entry.name !== 'index.html') {
      copyFileSync(srcPath, destPath);
      console.log(`✔ Copied file: ${entry.name}`);
    }
  }

  console.log('✓ ANSUZ build published to repo root. Commit and push to update Pages.');
  console.log('ℹ Root index.html now uses production asset paths. Use "git restore index.html" to revert for dev.');
} catch (error) {
  console.error('Error publishing ANSUZ build to root:', error);
  process.exit(1);
}
