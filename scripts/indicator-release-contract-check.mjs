import fs from 'node:fs';

const pagePath = 'tools/indicators/mtf-structure-panel/index.html';
const page = fs.readFileSync(pagePath, 'utf8');

const required = [
  'Candidate R0',
  '尚未开放',
  '等待 MetaEditor 目标版本 0 errors 验证',
  'v0.1.0 / NO TRADING',
  '编译后的MT4 `.ex4`',
];

for (const text of required) {
  if (!page.includes(text)) {
    throw new Error(`Indicator candidate contract missing: ${text}`);
  }
}

const forbidden = [
  '立即下载',
  '已经正式发布',
  '保证盈利',
  '自动下单',
];

for (const text of forbidden) {
  if (page.includes(text)) {
    throw new Error(`Indicator candidate page contains forbidden claim: ${text}`);
  }
}

console.log('Indicator candidate release boundary verified.');
