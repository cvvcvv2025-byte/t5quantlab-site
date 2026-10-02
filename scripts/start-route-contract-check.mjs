import fs from 'node:fs';

const page = fs.readFileSync('start/index.html', 'utf8');
const required = [
  'id="routePanel"',
  'id="startRoute"',
  '开始第一步',
  '进入这一步 →',
  "start.href=r[0][2]",
  "start.classList.add('show')",
  "scrollIntoView({behavior:'smooth',block:'start'})",
  'routeReady=false',
];

const errors = required.filter((text) => !page.includes(text));
if (errors.length) {
  console.error('Start route contract failed:');
  for (const text of errors) console.error(`- missing ${JSON.stringify(text)}`);
  process.exit(1);
}

if (!/r\.map\(x=>`<a class="path-card" href="\$\{x\[2\]\}"/.test(page)) {
  console.error('Start route contract failed: generated route cards must remain clickable links');
  process.exit(1);
}

console.log('Start route contract OK: mobile users receive an explicit first-step CTA, clickable route cards and automatic result focus.');
