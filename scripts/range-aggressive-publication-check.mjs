import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='tools/ea/range-boundary-aggressive/';
const html=fs.readFileSync(root+'index.html','utf8');
const csv=fs.readFileSync(root+'research-summary.csv','utf8').trim().split(/\r?\n/);
const [header,...data]=csv;const fields=header.split(',');
const rows=data.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[fields[i],v])));
assert.equal(rows.length,12);assert.deepEqual([...new Set(rows.map(x=>x.initial_usd))].sort(),['2000','3000','5000']);
for(const capital of ['2000','3000','5000'])for(const period of ['2026','2020-2026'])for(const path of ['P1','P2']){
 const x=rows.find(x=>x.initial_usd===capital&&x.period===period&&x.path===path);assert(x);
 for(const v of [Number(x.net_profit_usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),...(period==='2020-2026'?[Number(x.ending_balance_usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})]:[]),Number(x.max_equity_drawdown_percent).toFixed(2)])assert(html.includes(v),`missing row value ${v}`);
 if(period==='2020-2026'){assert(Number(x.net_profit_usd)<0);assert(Number(x.ending_balance_usd)<8);assert(Number(x.max_equity_drawdown_percent)>99);assert(Number(x.model_stopouts)>0)}
}
for(const text of ['次级暴力EA','建议测试资金2000—5000美元','100%篮子预算','关闭日亏损','可能损失全部本金','同一入场策略','不是经过证明的最低本金','99.79%—99.96%','不是MT4/MT5原生或真实tick回测','双平台编译文件已提供','v0.3.6'])assert(html.includes(text),text);
assert(!/href=["'][^"']*\.(?:mq4|mq5|ex4|ex5|zip)["']/i.test(html));
const center=fs.readFileSync('account/member-center/index.html','utf8');
const pending=center.match(/<article class="member-product" id="range-aggressive">([\s\S]*?)<\/article>/)?.[1];assert(pending);
assert(pending.includes('尚未完成原生或真实tick回测'));assert(pending.includes('安装包可用状态在本页自动核对'));assert(pending.includes('data-ea-download="range-aggressive"'));
for(const file of ['tools/ea/index.html','tools/ea/range-boundary/index.html','account/member-center/index.html','sitemap.xml'])assert(fs.readFileSync(file,'utf8').includes('/tools/ea/range-boundary-aggressive/'));
console.log('Aggressive publication: exact three-capital research values, full long-run loss disclosure, native-test limits and protected delivery passed.');
