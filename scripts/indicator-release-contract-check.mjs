import fs from 'node:fs';

const pagePath = 'tools/indicators/mtf-structure-panel/index.html';
const page = fs.readFileSync(pagePath, 'utf8');

const required = [
  'Candidate R1',
  '0 errors，0 warnings',
  'XAUUSD M5白底图表成功加载',
  '交付包已封存',
  '暂不提供公开直链',
  'v0.1.1 / NO TRADING',
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

if (/href=["'][^"']+\.(?:ex4|zip)(?:[?#][^"']*)?["']/i.test(page)) {
  throw new Error('Indicator candidate page must not expose a public artifact link before member download gating is live');
}

console.log('Indicator verified-candidate release boundary confirmed.');
