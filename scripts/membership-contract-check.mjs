import fs from 'node:fs';

const membership = fs.readFileSync('membership/index.html', 'utf8');
const account = fs.readFileSync('account/index.html', 'utf8');
const accountNav = fs.readFileSync('assets/account-nav.js', 'utf8');
const eaMatrix = fs.readFileSync('tools/ea/index.html', 'utf8');
const attackCompletion = fs.readFileSync('tools/ea/attack-completion-c/index.html', 'utf8');
const errors = [];
const need = (ok, message) => { if (!ok) errors.push(message); };

for (const html of [membership, account]) need(html.includes('不自动续费'), 'Membership plans must disclose no auto-renewal');
need(/\$13\.90(?:\s|<[^>]+>)*\/ 90天/.test(membership), 'Indicator Member launch price must be $13.90 / 90 days');
need(account.includes('$13.90 / 90天'), 'Account must show the Indicator Member checkout price');

need(membership.includes('历史绩效审计仍未通过'), 'Restored software must retain the actual unqualified performance disclosure');
need((membership.match(/<span class="plan-state ready">授权版升级中<\/span>/g) || []).length === 2, 'Both membership plans must disclose the protected-delivery hold');
need(membership.includes('href="/membership/checkout/"'), 'Indicator membership must link to checkout');
need(membership.includes('.ex4 / .ex5'), 'Membership page must disclose downloadable MT4/MT5 file formats');
need(membership.includes('4 款指标，MT4／MT5 按包核验') && membership.includes('T5 Structure Decision Map v0.3.0'), 'Membership page must disclose the exact current delivery count');
need(membership.includes('T5 MTF Structure Panel v0.1.1'), 'Membership page must list the released structure panel');
need(membership.includes('T5 Neckline MTF v0.1.2'), 'Membership page must list the released neckline indicator');
need(membership.includes('T5 Progress Candle v0.1.2'), 'Membership page must list the released progress candle indicator');
need(account.includes('以会员中心核验为准'), 'Account page must direct customers to actual delivery readiness');
need(membership.includes('T5 Attack Completion C v6.10.8'), 'Membership page must list the released MT5 EA');
need(['T5 Attack Completion C', 'T5 Trend Capture', 'T5 Range Boundary'].every(name => eaMatrix.includes(name)), 'EA hub must expose the three-product matrix');
need(eaMatrix.includes('+7.84%') && eaMatrix.includes('1.41') && eaMatrix.includes('3.42%'), 'EA hub must publish the frozen 6108 verification snapshot');
need(attackCompletion.includes('最大净值回撤') && attackCompletion.includes('冻结版本') && attackCompletion.includes('稳健型'), '6108 page must preserve its conservative frozen positioning');
need(membership.includes('$59.90') && membership.includes('/membership/automation-checkout/'), 'Automation membership must show its live 90-day checkout');
need(membership.includes('/account/member-center/'), 'Membership page must link to the member content center');
need(accountNav.includes("membership.href='/membership/'"), 'Global account navigation must expose the membership page');
need(membership.includes('$14.90') && membership.includes('3次 AI 深度源码分析') && membership.includes('2次完整源码修改'), 'Builder Pass must remain a separate $14.90 service with 3+2 credits');
need(!/稳赚|保本收益|承诺盈利/.test(membership), 'Membership copy must not promise trading profits');

if (errors.length) {
  console.error('Membership contract check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Membership contract OK: indicator and automation plans, released tools, file formats and Builder separation verified.');
