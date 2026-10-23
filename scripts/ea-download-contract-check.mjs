import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const need=(s,t,l)=>{if(!s.includes(t))errors.push(l+': missing '+JSON.stringify(t))};
const worker=read('src/account-worker.js');
const center=read('account/member-center/index.html');
const checkout=read('membership/automation-checkout/index.html');
const attack=read('tools/ea/attack-completion-c/index.html');
const trend=read('tools/ea/trend-capture/index.html');
const admin=read('admin/members/index.html');

need(worker,'"attack-completion-c"','Attack Completion artifact registry');
need(worker,'attack_completion_c_mt5','Attack Completion product code');
need(worker,'fb234bc63c8c6ec2e63d387a5becf272c12983d0ce1e1312e4b5da5c1ab9ae53','Attack Completion customer pack checksum');
need(worker,'"trend-capture"','Trend Capture artifact registry');
need(worker,'trend_capture_mt5','Trend Capture product code');
need(worker,'39329acf4722e0ec921e7cada7529a686e9e6835dc83c8562a605bbce5e33f37','Trend Capture customer pack checksum');
need(worker,'/api\\/member\\/eas\\/','protected EA route');
need(worker,'EA_ENTITLEMENT_REQUIRED','EA entitlement guard');
need(worker,'X-T5-Artifact-SHA256','download integrity header');
need(center,'data-ea-download="attack-completion-c"','Attack Completion member download button');
need(center,'data-ea-download="trend-capture"','Trend Capture member download button');
need(center,'T5_trend_capture_0_1_0_LicenseV2_Customer_Pack.zip','Trend Capture customer filename');
need(center,'trend_capture_mt5','single-product Trend Capture entitlement display');
need(admin,'ea:trend-capture','Trend Capture admin artifact selector');
need(admin,'trend_capture_mt5','Trend Capture standalone entitlement selector');
need(checkout,"PRODUCT='premium_membership'",'automation checkout product');
need(attack,'MT5 · v6.10.8 · 稳健型 · 冻结版本','released conservative product page');
need(attack,'最大净值回撤','equity drawdown label');
need(trend,'MT5 · XAUUSD · v0.1.0 · 已发布','released Trend Capture product page');
need(trend,'0 errors, 0 warnings','Trend Capture compile evidence');
need(trend,'不展示收益、胜率或盈利因子','Trend Capture unverified-performance boundary');

if(errors.length){
  console.error('EA download contract failed:');
  errors.forEach(e=>console.error('- '+e));
  process.exit(1);
}
console.log('EA download contract OK: both published EA packages are entitlement-gated, hash-pinned and accurately disclosed.');
