import fs from 'node:fs';

const packs = [
  ['market-lab/practice/index.html', 24, '/market-lab/practice/'],
  ['market-lab/practice/context-structure/index.html', 12, '/market-lab/practice/context-structure/'],
  ['market-lab/practice/liquidity-execution/index.html', 12, '/market-lab/practice/liquidity-execution/'],
  ['market-lab/practice/risk-audit/index.html', 12, '/market-lab/practice/risk-audit/'],
  ['market-lab/practice/targets-volatility/index.html', 12, '/market-lab/practice/targets-volatility/'],
  ['market-lab/practice/range-compression/index.html', 12, '/market-lab/practice/range-compression/'],
  ['market-lab/practice/code-migration/index.html', 12, '/market-lab/practice/code-migration/']
];

let total = 0;
const errors = [];
const trainer = fs.readFileSync('assets/practice-trainer.js', 'utf8');
for (const [file, expected, route] of packs) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: missing`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const qCount = (html.match(/class=["']q["']/g) || []).length;
  const choiceCount = (html.match(/class=["']choices["']/g) || []).length;
  const answerCount = (html.match(/class=["']answer["']/g) || []).length;
  const correctCount = (html.match(/<strong>\s*(?:答案\s*[:：]\s*)?[A-D](?=[。．.、\s<])/gi) || []).length;
  total += qCount;
  if (qCount !== expected) errors.push(`${file}: expected ${expected} questions, found ${qCount}`);
  if (choiceCount !== qCount) errors.push(`${file}: choices ${choiceCount} != questions ${qCount}`);
  if (answerCount !== qCount) errors.push(`${file}: answers ${answerCount} != questions ${qCount}`);
  if (correctCount !== qCount) errors.push(`${file}: recognizable correct answers ${correctCount} != questions ${qCount}`);
  if (!trainer.includes(route)) errors.push(`practice-trainer.js: missing route ${route}`);
}

if (total !== 96) errors.push(`practice total: expected 96, found ${total}`);

const trainerPage = fs.readFileSync('market-lab/practice/trainer/index.html','utf8');
const transfer = fs.readFileSync('assets/practice-progress-transfer.js','utf8');
if (!trainerPage.includes('/assets/practice-progress-transfer.js')) errors.push('trainer page must load progress transfer helper');
if (!/localStorage/.test(transfer)) errors.push('progress transfer must use browser localStorage');
if (!/f\.text\s*\(\s*\)/.test(transfer)) errors.push('progress import must read selected JSON locally with File.text()');
if (!/questionBank\s*:\s*96/.test(transfer)) errors.push('progress export must pin the 96-question bank version');
if (!/entries\s*>\s*96/.test(transfer)) errors.push('progress import must reject more than 96 question entries');
if (/\bfetch\s*\(/.test(transfer)) errors.push('progress transfer must not call fetch()');
if (/new\s+XMLHttpRequest\s*\(/.test(transfer)) errors.push('progress transfer must not use XMLHttpRequest');
if (/new\s+FormData\s*\(/.test(transfer)) errors.push('progress transfer must not create FormData');
if (/["'`]\/api\//.test(transfer)) errors.push('progress transfer must not call /api/*');

const visualFile='assets/practice-visuals.js';
const visualCss='assets/practice-visuals.css';
if (!fs.existsSync(visualFile)) errors.push('beginner visual scenario script missing');
if (!fs.existsSync(visualCss)) errors.push('beginner visual scenario stylesheet missing');
if (fs.existsSync(visualFile)) {
  const visuals=fs.readFileSync(visualFile,'utf8');
  for(let i=1;i<=24;i++) if(!new RegExp(`\\n${i}:\\{`).test(visuals)) errors.push(`practice-visuals.js: Q${String(i).padStart(3,'0')} visual scene missing`);
  if(!visuals.includes('前高 / 外部流动性区域')) errors.push('practice-visuals.js: Q002 location visual must show prior-high liquidity');
  if(!visuals.includes('最近结构支撑在较远下方')) errors.push('practice-visuals.js: Q002 location visual must show distant structural support');
  if(!visuals.includes('先看图，再读题')) errors.push('practice-visuals.js: visual-first instruction missing');
  if(!visuals.includes('新手建议')) errors.push('practice-visuals.js: beginner guidance missing');
  if(/\bfetch\s*\(/.test(visuals)) errors.push('practice visual layer must remain API-free');
  if(/["'`]\/api\//.test(visuals)) errors.push('practice visual layer must not call /api/*');
}
if (!transfer.includes('/assets/practice-visuals.js')) errors.push('progress helper must load beginner visual scenario script');
if (!transfer.includes('/assets/practice-visuals.css')) errors.push('progress helper must load beginner visual scenario stylesheet');

if (errors.length) {
  console.error('Practice contract check failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Practice contract OK: ${total} questions across ${packs.length} packs; local backup/restore and Q001-Q024 visual-first training protected.`);
