(()=>{
'use strict';
const path=location.pathname.endsWith('/')?location.pathname:location.pathname+'/';
const hubs=new Set(['/','/library/','/research/','/market-lab/','/verification/','/tools/','/faq/','/market-lab/practice/','/market-lab/practice/trainer/']);
if(hubs.has(path)||document.querySelector('.auto-related'))return;
const card=(eyebrow,title,text,href)=>({eyebrow,title,text,href});
const groups={
 indicators:[
  card('PRACTICE','Indicator Foundations 36题','用指标快照训练均线、MACD、RSI、Bollinger、ADX、Ichimoku、ATR与量价指标。','/market-lab/practice/indicator-foundations/'),
  card('READING','指标交易专项书单','18本/套专项资料，从指标来源、系统设计到回测验证。','/library/books/indicator-route/'),
  card('DESIGN','六类策略框架','先确定趋势跟随、均值回归、突破等策略类型，再决定指标职责。','/library/strategy-families/')
 ],
 books:[
  card('INDICATORS','指标专项阅读路线','如果你使用MACD、RSI、Bollinger、ADX或Ichimoku，从专项18本/套继续。','/library/books/indicator-route/'),
  card('PRACTICE','132题多方法训练','读完回到可判分题目，不让阅读停在“我好像懂了”。','/market-lab/practice/trainer/'),
  card('LIBRARY','13条方法路线','回到Library按传统指标、Classic TA、PA、SMC、Auction、Risk或EA继续。','/library/')
 ],
 structure:[
  card('PRACTICE','Context & Structure 专题','用12道题检查多周期、BOS/CHOCH、颈线和接管。','/market-lab/practice/context-structure/'),
  card('RESEARCH','Entry 状态机','看 Probe / Wait / Main Entry 如何把结构证据转成执行授权。','/research/entry-state-machine/'),
  card('VERIFY','EA账户级审计','检查程序有没有把人工结构语义正确实现。','/verification/audit-checklist/')
 ],
 liquidity:[
  card('PRACTICE','Liquidity & Execution 专题','训练 Sweep、Reclaim、Acceptance、FVG、二次拒绝和Retest。','/market-lab/practice/liquidity-execution/'),
  card('REAL CASE','Reclaim / 失败突破案例','把颈线失败、Acceptance与路径切换放在一起比较。','/market-lab/collections/reclaim-failed-breaks/'),
  card('RESEARCH','流动性双路径框架','Sweep-Reversal 与 Break-Acceptance-Retest 不预设谁必然发生。','/research/liquidity-framework/')
 ],
 risk:[
  card('PRACTICE','Risk & EA Audit 专题','T1、Runner、重复授权、CSV和发布门槛。','/market-lab/practice/risk-audit/'),
  card('RESEARCH','Position Management C','T1减仓 → 保本 → Runner，看状态机如何冻结。','/research/position-management-c/'),
  card('VERIFY','账户级审计清单','把显示层状态落实到账户真实成交与SL修改。','/verification/audit-checklist/')
 ],
 environment:[
  card('PRACTICE','Targets & Volatility 专题','目标、ATR、Session、新闻和真实成交R。','/market-lab/practice/targets-volatility/'),
  card('PRACTICE','Range & Compression 专题','边界、压缩、Failed Auction与路径切换。','/market-lab/practice/range-compression/'),
  card('LIBRARY','回到完整学习地图','把环境条件重新放回 Context → Regime → Measure → Trigger 链。','/library/')
 ],
 research:[
  card('VERIFY','Evidence Ledger','查看版本、CSV、失败样本和证据链。','/verification/evidence-ledger/'),
  card('REAL CASE','Market Lab真实案例','用具体样本检查研究假设在执行中如何表现。','/market-lab/#visual-cases'),
  card('VERIFY','EA账户级审计','在继续优化参数前先排除程序与状态错误。','/verification/audit-checklist/')
 ],
 case:[
  card('PRACTICE','132题多方法互动训练','把案例里的判断拆回题目，同时覆盖传统指标与Structure/PA/SMC。','/market-lab/practice/trainer/'),
  card('LIBRARY','Library多方法学习地图','按当前方法回查Context、Regime、Signal、Risk和Review。','/library/'),
  card('VERIFY','账户级审计','如果案例涉及EA，继续检查订单、状态与CSV证据。','/verification/audit-checklist/')
 ],
 engineering:[
  card('FREE','高级免费源码体检','先在浏览器本地扫描结构、风险与修改影响范围。','/tools/strategy-builder/inspect/'),
  card('GUIDE','源码修改前审计','先识别 Entry / Exit / Risk / State 和外部依赖。','/tools/source-code-audit-guide/'),
  card('FAQ','Builder与源码常见问题','查看隐私、退款、平台迁移和AI修改边界。','/faq/#builder')
 ]
};
function pick(){
 if(path.startsWith('/market-lab/')&&(path.includes('2026-')||path.includes('/training/')))return groups.case;
 if(path.startsWith('/research/'))return groups.research;
 if(path.startsWith('/tools/'))return groups.engineering;
 if(path.startsWith('/verification/'))return groups.risk;
 if(!path.startsWith('/library/'))return null;
 if(path.startsWith('/library/books/'))return groups.books;
 if(path.startsWith('/library/indicators/'))return groups.indicators;
 if(/liquidity|sweep|reclaim|acceptance|fvg|order-block|eqh-eql|premium-discount|attack-pivot|second-rejection|break-retest/.test(path))return groups.liquidity;
 if(/risk|position|mfe-mae|target-selection/.test(path))return groups.risk;
 if(/atr|session|news|trend-age|compression|failed-auction|range-boundary|volume-profile|fibonacci|wedge/.test(path))return groups.environment;
 return groups.structure;
}
const items=pick();if(!items)return;
const main=document.querySelector('main');if(!main)return;
const section=document.createElement('section');section.className='section alt auto-related';
section.innerHTML='<div class="container"><div class="head"><h2>继续下一步</h2><p>根据当前页面主题，继续训练、阅读、看样本或进入验证，而不是停在术语解释。</p></div><div class="grid3">'+items.map(x=>'<a class="card link-card" href="'+x.href+'"><small>'+x.eyebrow+'</small><h3>'+x.title+'</h3><p>'+x.text+'</p></a>').join('')+'</div></div>';
const footer=document.querySelector('footer');main.insertBefore(section,footer&&footer.parentNode===main?footer:null);
})();
