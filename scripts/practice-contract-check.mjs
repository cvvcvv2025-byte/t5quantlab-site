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

  const trainer = fs.readFileSync('assets/practice-trainer.js', 'utf8');
  if (!trainer.includes(route)) errors.push(`practice-trainer.js: missing route ${route}`);
}

if (total !== 96) errors.push(`practice total: expected 96, found ${total}`);

if (errors.length) {
  console.error('Practice contract check failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Practice contract OK: ${total} questions across ${packs.length} packs.`);
