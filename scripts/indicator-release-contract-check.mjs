import fs from 'node:fs';

const pagePath = 'tools/indicators/mtf-structure-panel/index.html';
const page = fs.readFileSync(pagePath, 'utf8');

const required = [
  'MT4 · MULTI-TIMEFRAME · READ-ONLY INDICATOR',
  '使用边界',
  '只读取已收盘K线',
  '会员下载：',
  '安装包不使用公开直链',
  'v0.1.1',
  '编译后的MT4 `.ex4`',
  '当前支持MT4',
];

for (const text of required) {
  if (!page.includes(text)) {
    throw new Error(`Indicator release boundary missing: ${text}`);
  }
}

const forbidden = [
  '立即下载',
  '已经正式发布',
  '保证盈利',
  '自动下单',
  'Candidate R1',
  'NEXT GATE',
  'Research Build',
];

for (const text of forbidden) {
  if (page.includes(text)) {
    throw new Error(`Indicator page contains forbidden claim or internal status copy: ${text}`);
  }
}

if (/href=["'][^"']+\.(?:ex4|zip)(?:[?#][^"']*)?["']/i.test(page)) {
  throw new Error('Indicator page must not expose a public artifact link before member download gating is live');
}

console.log('Indicator customer-facing release boundary confirmed.');
