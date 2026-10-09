import fs from 'node:fs';

const membership = fs.readFileSync('membership/index.html', 'utf8');
const account = fs.readFileSync('account/index.html', 'utf8');
const accountNav = fs.readFileSync('assets/account-nav.js', 'utf8');
const errors = [];
const need = (ok, message) => { if (!ok) errors.push(message); };

for (const html of [membership, account]) need(html.includes('不自动续费'), 'Membership plans must disclose no auto-renewal');
need(/\$13\.90(?:\s|<[^>]+>)*\/ 90天/.test(membership), 'Indicator Member launch price must be $13.90 / 90 days');
need(account.includes('$13.90 / 90天'), 'Account must show the Indicator Member checkout price');

need(membership.includes('<span class="plan-state ready">现在可购买</span>'), 'Indicator membership must be visibly open');
need((membership.match(/<span class="plan-state wait">暂不可购买<\/span>/g) || []).length === 1, 'Automation membership alone must remain closed');
need(membership.includes('href="/membership/checkout/"'), 'Indicator membership must link to checkout');
need(membership.includes('.ex4 / .ex5'), 'Membership page must disclose downloadable MT4/MT5 file formats');
need(membership.includes('3 个 MT4 指标安装包'), 'Membership page must disclose the exact current delivery count');
need(membership.includes('T5 MTF Structure Panel v0.1.1'), 'Membership page must list the released structure panel');
need(membership.includes('T5 Neckline MTF v0.1.2'), 'Membership page must list the released neckline indicator');
need(membership.includes('T5 Progress Candle v0.1.2'), 'Membership page must list the released progress candle indicator');
need(account.includes('3 个正式 MT4 指标安装包'), 'Account page must disclose the exact current delivery count');
need(membership.includes('无 Release 版本'), 'Membership page must disclose that no EA release exists');
need(membership.includes('/account/member-center/'), 'Membership page must link to the member content center');
need(accountNav.includes("membership.href='/membership/'"), 'Global account navigation must expose the membership page');
need(membership.includes('$14.90') && membership.includes('3次 AI 深度源码分析') && membership.includes('2次完整源码修改'), 'Builder Pass must remain a separate $14.90 service with 3+2 credits');
need(!/稳赚|保本收益|承诺盈利/.test(membership), 'Membership copy must not promise trading profits');

if (errors.length) {
  console.error('Membership contract check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Membership contract OK: launch prices, release gates, file formats and Builder separation verified.');
