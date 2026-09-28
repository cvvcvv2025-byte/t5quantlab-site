import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules']);
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(root);

function targetExists(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return fs.existsSync(path.join(root, 'index.html'));
  const rel = clean.replace(/^\//, '');
  const direct = path.join(root, rel);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return true;
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory() && fs.existsSync(path.join(direct, 'index.html'))) return true;
  if (fs.existsSync(`${direct}.html`)) return true;
  return false;
}

const broken = [];
for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /href=["']([^"']+)["']/gi;
  for (const match of text.matchAll(re)) {
    const href = match[1];
    if (!href.startsWith('/')) continue;
    if (href.startsWith('//') || href.startsWith('/api/')) continue;
    if (!targetExists(href)) broken.push(`${path.relative(root, file)} -> ${href}`);
  }
}

if (broken.length) {
  console.error('Broken internal links:');
  for (const item of broken) console.error(`- ${item}`);
  process.exit(1);
}
console.log(`Internal link check passed: ${htmlFiles.length} HTML files scanned.`);
