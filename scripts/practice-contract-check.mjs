import fs from 'node:fs';

const packs = [
  ['market-lab/practice/index.html', 24, '/market-lab/practice/'],
  ['market-lab/practice/context-structure/index.html', 12, '/market-lab/practice/context-structure/'],
  ['market-lab/practice/liquidity-execution/index.html', 12, '/market-lab/practice/liquidity-execution/'],
  ['market-lab/practice/risk-audit/index.html', 12, '/market-lab/practice/risk-audit/'],
  ['market-lab/practice/targets-volatility/index.html', 12, '/market-lab/practice/targets-volatility/'],
  ['market-lab/practice/range-compression/index.html', 12, '/market-lab/practice/range-compression/'],
  ['market-lab/practice/code-migration/index.html', 12, '/market-lab/practice/code-migration/'],
  ['market-lab/practice/indicator-foundations/index.html', 36, '/market-lab/practice/indicator-foundations/']
];

const EXPECTED_TOTAL = 132;
let total = 0;
const errors = [];
const trainer = fs.readFileSync('assets/practice-trainer.js', 'utf8');
for (const [file, expected, route] of packs) {
  if (!fs.existsSync(file)) { errors.push(`${file}: missing`); continue; }
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
if (total !== EXPECTED_TOTAL) errors.push(`practice total: expected ${EXPECTED_TOTAL}, found ${total}`);

const trainerPage = fs.readFileSync('market-lab/practice/trainer/index.html','utf8');
const transfer = fs.readFileSync('assets/practice-progress-transfer.js','utf8');
if (!trainerPage.includes('132题多方法互动训练器')) errors.push('trainer page must present the 132-question multi-method identity');
if (!trainerPage.includes('/assets/indicator-practice.css')) errors.push('trainer page must load indicator snapshot styles');
if (!trainerPage.includes('/assets/practice-progress-transfer.js')) errors.push('trainer page must load progress transfer helper');
if (!/localStorage/.test(transfer)) errors.push('progress transfer must use browser localStorage');
if (!/f\.text\s*\(\s*\)/.test(transfer)) errors.push('progress import must read selected JSON locally with File.text()');
if (!/QUESTION_BANK\s*=\s*132/.test(transfer)) errors.push('progress transfer must pin the 132-question bank version');
if (/\bfetch\s*\(/.test(transfer)) errors.push('progress transfer must not call fetch()');
if (/new\s+XMLHttpRequest\s*\(/.test(transfer)) errors.push('progress transfer must not use XMLHttpRequest');
if (/new\s+FormData\s*\(/.test(transfer)) errors.push('progress transfer must not create FormData');
if (/["'`]\/api\//.test(transfer)) errors.push('progress transfer must not call /api/*');

const visualFile='assets/practice-visuals.js';
const advancedVisualFile='assets/practice-visuals-advanced.js';
const visualCss='assets/practice-visuals.css';
if (!fs.existsSync(visualFile)) errors.push('beginner visual scenario script missing');
if (!fs.existsSync(advancedVisualFile)) errors.push('advanced visual scenario script missing');
if (!fs.existsSync(visualCss)) errors.push('practice visual scenario stylesheet missing');
if (fs.existsSync(visualFile)) {
  const visuals=fs.readFileSync(visualFile,'utf8');
  for(let i=1;i<=24;i++) if(!new RegExp(`\\n${i}:\\{`).test(visuals)) errors.push(`practice-visuals.js: Q${String(i).padStart(3,'0')} visual scene missing`);
  if(!visuals.includes('前高 / 外部流动性区域')) errors.push('practice-visuals.js: Q002 location visual must show prior-high liquidity');
  if(!visuals.includes('最近结构支撑在较远下方')) errors.push('practice-visuals.js: Q002 location visual must show distant structural support');
  if(!visuals.includes('先看图，再读题')) errors.push('practice-visuals.js: visual-first instruction missing');
  if(/\bfetch\s*\(/.test(visuals)) errors.push('practice beginner visual layer must remain API-free');
}
if (fs.existsSync(advancedVisualFile)) {
  const advanced=fs.readFileSync(advancedVisualFile,'utf8');
  for(let i=25;i<=96;i++) if(!new RegExp(`\\n${i}:\\[`).test(advanced)) errors.push(`practice-visuals-advanced.js: Q${String(i).padStart(3,'0')} visual scene missing`);
  if(!advanced.includes('Q025–084 · 半标注识别，可选提示')) errors.push('advanced visuals: semi-labelled guidance missing');
  if(!advanced.includes('Q085–096 · 工程状态 / 流程审计')) errors.push('advanced visuals: engineering flow guidance missing');
  if(!advanced.includes('显示辅助标注')) errors.push('advanced visuals: hint toggle missing');
  if(/\bfetch\s*\(/.test(advanced)) errors.push('practice advanced visual layer must remain API-free');
}

const indicatorPack='market-lab/practice/indicator-foundations/index.html';
if (fs.existsSync(indicatorPack)) {
  const html=fs.readFileSync(indicatorPack,'utf8');
  const snapshots=(html.match(/class=["']question-visual["']/g)||[]).length;
  if (snapshots !== 36) errors.push(`indicator foundations: expected 36 visual snapshots, found ${snapshots}`);
  for (const term of ['MACD','BOLLINGER','RSI','ADX','STOCHASTIC','ICHIMOKU','ATR','VWAP']) {
    if (!html.toUpperCase().includes(term)) errors.push(`indicator foundations: missing ${term} coverage`);
  }
}
if (!trainer.includes("topic:'Indicators'")) errors.push('trainer must classify the indicator pack separately');
if (!trainer.includes("visual:q.querySelector('.question-visual')")) errors.push('trainer must preserve per-question indicator snapshots');
if (!transfer.includes('/assets/indicator-practice.css')) errors.push('progress helper must preserve indicator snapshot styles');
if (!transfer.includes('/assets/practice-visuals.js')) errors.push('progress helper must keep beginner visual layer');
if (!transfer.includes('/assets/practice-visuals-advanced.js')) errors.push('progress helper must keep advanced visual layer');

if (errors.length) {
  console.error('Practice contract check failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Practice contract OK: ${total} questions across ${packs.length} packs; original Q001-Q096 progress IDs preserved and 36 indicator snapshots added.`);
