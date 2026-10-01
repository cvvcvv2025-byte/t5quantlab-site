import fs from 'node:fs';

const membership = fs.readFileSync('membership/index.html', 'utf8');
const account = fs.readFileSync('account/index.html', 'utf8');
const accountNav = fs.readFileSync('assets/account-nav.js', 'utf8');
const errors = [];
const need = (ok, message) => { if (!ok) errors.push(message); };

for (const html of [membership, account]) {
  need(/¥99(?:\s|<[^>]+>)*\/ 90天/.test(html), 'Indicator Member launch price must be ¥99 / 90 days');
  need(/¥399(?:\s|<[^>]+>)*\/ 90天/.test(html), 'Automation Member launch price must be ¥399 / 90 days');
  need(html.includes('不自动续费'), 'Membership plans must disclose no auto-renewal');
}

need((membership.match(/<span class="plan-state wait">暂不可购买<\/span>/g) || []).length >= 2, 'Indicator and automation purchases must remain visibly closed');
need(!membership.includes('href="/checkout/?plan=indicator') && !membership.includes('href="/checkout/?plan=automation'), 'Closed membership plans must not expose checkout links');
need(membership.includes('.ex4 / .ex5'), 'Membership page must disclose downloadable MT4/MT5 file formats');
need(accountNav.includes("membership.href='/membership/'"), 'Global account navigation must expose the membership page');
need(membership.includes('$14.90') && membership.includes('3次 AI 深度源码分析') && membership.includes('2次完整源码修改'), 'Builder Pass must remain a separate $14.90 service with 3+2 credits');
need(!/稳赚|保本收益|承诺盈利/.test(membership), 'Membership copy must not promise trading profits');

if (errors.length) {
  console.error('Membership contract check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Membership contract OK: launch prices, release gates, file formats and Builder separation verified.');
