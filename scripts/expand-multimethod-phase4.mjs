import fs from 'node:fs';

function edit(file, fn){
  let s=fs.readFileSync(file,'utf8');
  const before=s;
  s=fn(s);
  if(s!==before){fs.writeFileSync(file,s);console.log('updated',file)} else console.log('no change',file);
}
const all=(s,a,b)=>s.split(a).join(b);

edit('index.html',s=>{
  s=all(s,'216题多方法公开训练','288题多方法公开训练');
  s=all(s,'<b>216</b>公开训练题','<b>288</b>公开训练题');
  s=all(s,'<b>216</b><span>公开训练题</span>','<b>288</b><span>公开训练题</span>');
  s=all(s,'<b>13</b><span>训练专题 / 专项包</span>','<b>19</b><span>训练专题 / 专项包</span>');
  if(!s.includes('六大指标专项')){
    const n='<a href="/market-lab/practice/macd-specialist/">MACD / Bollinger / RSI专项 <span>→</span></a>';
    if(s.includes(n)) s=s.replace(n,n+'<a href="/market-lab/">六大指标专项：MA / ADX / Stochastic / Ichimoku / Volume / Volatility <span>→</span></a>');
  }
  return s;
});

edit('library/index.html',s=>{
  s=all(s,'216题公开训练','288题公开训练');
  s=all(s,'现在有216题多方法公开训练。','现在有288题多方法公开训练。');
  s=all(s,'132题统一训练器保持旧进度；另有84题专项包：Indicator Applied 24、Classic TA 24、MACD/Bollinger/RSI各12。','132题统一训练器保持旧进度；另有156题专项包，覆盖Classic TA与九组传统指标专项。');
  return s;
});

edit('market-lab/index.html',s=>{
  s=all(s,'216道多方法公开训练题','288道多方法公开训练题');
  s=all(s,'216道多方法公开训练','288道多方法公开训练');
  s=all(s,'当前216题分成132题统一训练器与84题独立专项包。统一训练器保留旧进度；专项包继续扩展Classic TA与具体指标。','当前288题分成132题统一训练器与156题独立专项包。统一训练器保留旧进度；专项包覆盖Classic TA与九组传统指标。');
  s=all(s,'进入216题训练中心','进入288题训练中心');
  s=all(s,'<b>216</b><span>PUBLIC DRILLS</span>','<b>288</b><span>PUBLIC DRILLS</span>');
  s=all(s,'<b>13</b><span>TOPIC / SPECIALIST PACKS</span>','<b>19</b><span>TOPIC / SPECIALIST PACKS</span>');
  s=all(s,'216题仍只是当前阶段，不是终点。','288题仍只是当前阶段，不是终点。');
  s=all(s,'<b>216</b><span>公开训练题</span>','<b>288</b><span>公开训练题</span>');
  s=all(s,'<b>13</b><span>专题 / 专项包</span>','<b>19</b><span>专题 / 专项包</span>');
  s=all(s,'96题指标训练：基础36 + 应用24 + 三个专项36','168题指标训练：基础36 + 应用24 + 九个专项108');
  s=all(s,'先学指标测什么，再进入MACD、Bollinger、RSI专项；重点训练Regime、组合、状态、参数和失效。','先学指标测什么，再进入MACD、Bollinger、RSI、MA、ADX、Stochastic、Ichimoku、Volume与Volatility专项。');
  const marker='<a class="feature-row" href="/market-lab/practice/rsi-specialist/"';
  if(s.includes(marker)&&!s.includes('/market-lab/practice/adx-dmi-specialist/')){
    const pos=s.indexOf(marker); const end=s.indexOf('</a>',pos)+4;
    const extra='<a class="feature-row" href="/market-lab/practice/moving-averages-specialist/"><div class="feature-index">12Q</div><div><h3>Moving Averages Specialist</h3><p>斜率、排列、回踩、交叉、趋势年龄与归一化。</p></div></a><a class="feature-row" href="/market-lab/practice/adx-dmi-specialist/"><div class="feature-index">12Q</div><div><h3>ADX / DMI Specialist</h3><p>趋势强度、方向、Regime、滞后与退出。</p></div></a><a class="feature-row" href="/market-lab/practice/stochastic-specialist/"><div class="feature-index">12Q</div><div><h3>Stochastic Specialist</h3><p>区间极值、趋势钝化、交叉、背离与参数。</p></div></a><a class="feature-row" href="/market-lab/practice/ichimoku-specialist/"><div class="feature-index">12Q</div><div><h3>Ichimoku Specialist</h3><p>Tenkan/Kijun/Kumo/Chikou、多周期与Parity。</p></div></a><a class="feature-row" href="/market-lab/practice/volume-indicators-specialist/"><div class="feature-index">12Q</div><div><h3>VWAP / OBV / MFI Specialist</h3><p>Session、锚点、数据源、背离与量价Parity。</p></div></a><a class="feature-row" href="/market-lab/practice/volatility-channels-specialist/"><div class="feature-index">12Q</div><div><h3>ATR / Keltner / Donchian Specialist</h3><p>波动归一化、通道、突破、滑点与状态。</p></div></a>';
    s=s.slice(0,end)+extra+s.slice(end);
  }
  return s;
});

edit('library/indicators/index.html',s=>{
  if(!s.includes('六组新增专项')){
    const marker='<section class="section alt"><div class="container"><div class="head"><h2>指标组合不是“越多越安全”</h2>';
    const block='<section class="section"><div class="container"><div class="head"><h2>六组新增专项训练</h2><p>教材负责理解，专项题负责暴露误判。每组12题，全部带状态快照和EA边界。</p></div><div class="indicator-grid"><a class="indicator-card" href="/market-lab/practice/moving-averages-specialist/"><small>12Q</small><h3>Moving Averages</h3><p>斜率、排列、回踩、参数、MTF与事件状态。</p></a><a class="indicator-card" href="/market-lab/practice/adx-dmi-specialist/"><small>12Q</small><h3>ADX / DMI</h3><p>Strength≠Direction、Regime、滞后和退出。</p></a><a class="indicator-card" href="/market-lab/practice/stochastic-specialist/"><small>12Q</small><h3>Stochastic</h3><p>区间极值、趋势钝化、背离与重复授权。</p></a><a class="indicator-card" href="/market-lab/practice/ichimoku-specialist/"><small>12Q</small><h3>Ichimoku</h3><p>云内外、Kijun、Chikou、多周期与Lookahead。</p></a><a class="indicator-card" href="/market-lab/practice/volume-indicators-specialist/"><small>12Q</small><h3>VWAP / OBV / MFI</h3><p>Session、Anchored VWAP、数据源与量价背离。</p></a><a class="indicator-card" href="/market-lab/practice/volatility-channels-specialist/"><small>12Q</small><h3>ATR / Keltner / Donchian</h3><p>距离归一化、压缩、突破、滑点与状态。</p></a></div></div></section>';
    if(s.includes(marker)) s=s.replace(marker,block+marker);
  }
  return s;
});

for(const [file,route,label] of [
 ['library/indicators/moving-averages/index.html','/market-lab/practice/moving-averages-specialist/','均线专项12题'],
 ['library/indicators/adx-dmi/index.html','/market-lab/practice/adx-dmi-specialist/','ADX / DMI专项12题'],
 ['library/indicators/stochastic/index.html','/market-lab/practice/stochastic-specialist/','Stochastic专项12题'],
 ['library/indicators/ichimoku/index.html','/market-lab/practice/ichimoku-specialist/','Ichimoku专项12题'],
 ['library/indicators/volume-indicators/index.html','/market-lab/practice/volume-indicators-specialist/','VWAP / OBV / MFI专项12题'],
 ['library/indicators/volatility-channels/index.html','/market-lab/practice/volatility-channels-specialist/','ATR / Keltner / Donchian专项12题']
]) edit(file,s=>{
  if(s.includes(route)) return s;
  const block=`<section class="section alt"><div class="container"><div class="head"><h2>专项训练</h2><p>读完教材后用12道场景题检查Regime、多周期、参数、失效和EA状态。</p></div><div class="actions"><a class="btn primary" href="${route}">${label}</a><a class="btn" href="/market-lab/practice/indicator-applied/">Indicator Applied 24题</a></div></div></section>`;
  return s.replace('</main>',block+'</main>');
});

edit('library/books/index.html',s=>{
  s=all(s,'交易书籍馆：30本技术分析、Price Action、Market Profile、系统交易、量化、风险与交易心理核心书籍','交易书籍馆：30本核心 + 30本扩展，覆盖技术分析、传统指标、Price Action、Market Profile、系统交易、量化、微观结构、风险与心理');
  s=all(s,'30本核心交易书籍，不做资源堆积；按问题找书，读完回到训练、案例与研究。','60本分层交易书库：核心30本负责主干，扩展30本补指标、Classic TA、系统与市场微观结构。');
  s=all(s,'30本核心交易书籍，配中文阅读路线、误读提醒和T5训练连接。','60本分层交易书库：核心30 + 扩展30，配中文阅读路线与训练连接。');
  s=all(s,'30 CORE TITLES · 5 DOMAINS · PROBLEM-FIRST READING · NO PIRATED PDF','30 CORE + 30 EXTENDED · PROBLEM-FIRST READING · NO PIRATED PDF');
  s=all(s,'<a class="btn" href="#catalog">浏览30本</a>','<a class="btn" href="#catalog">浏览核心30本</a><a class="btn" href="/library/books/extended-catalog/">扩展30本</a>');
  s=all(s,'<div class="book-kpi"><b>30</b><span>核心书籍</span></div><div class="book-kpi"><b>5</b><span>学习方向</span></div>','<div class="book-kpi"><b>60</b><span>分层书目</span></div><div class="book-kpi"><b>30+30</b><span>核心 + 扩展</span></div>');
  if(!s.includes('扩展30本不是第二份“必读清单”')){
    const marker='<section class="section"><div class="container"><div class="head"><h2>按经验阶段读</h2>';
    const block='<section class="section"><div class="container"><div class="head"><h2>扩展30本不是第二份“必读清单”</h2><p>核心30本负责主干；扩展30本只在你进入具体分支时使用。比如ADX/RSI读Wilder，Bollinger读Bollinger本人，Ichimoku读Patel/Elliott，系统/滤波再进入Ehlers、Carver等。</p></div><div class="actions"><a class="btn primary" href="/library/books/extended-catalog/">打开扩展30本</a><a class="btn" href="/library/books/indicator-route/">指标专项阅读</a></div></div></section>';
    if(s.includes(marker)) s=s.replace(marker,block+marker);
  }
  return s;
});

edit('library/books/indicator-route/index.html',s=>{
  if(!s.includes('/library/books/extended-catalog/')){
    s=s.replace('</main>','<section class="section"><div class="container"><div class="head"><h2>继续扩展</h2><p>如果当前18本专项已经读过或需要更细的趋势、周期、Ichimoku与微观结构资料，进入扩展30本。</p></div><div class="actions"><a class="btn primary" href="/library/books/extended-catalog/">扩展30本书库</a><a class="btn" href="/market-lab/">专项训练中心</a></div></div></section></main>');
  }
  return s;
});

edit('sitemap.xml',s=>{
  const routes=[
    '/market-lab/practice/moving-averages-specialist/',
    '/market-lab/practice/adx-dmi-specialist/',
    '/market-lab/practice/stochastic-specialist/',
    '/market-lab/practice/ichimoku-specialist/',
    '/market-lab/practice/volume-indicators-specialist/',
    '/market-lab/practice/volatility-channels-specialist/',
    '/library/books/extended-catalog/'
  ];
  let rows='';
  for(const r of routes){const u='https://t5quantlab.com'+r;if(!s.includes(`<loc>${u}</loc>`)) rows+=`  <url><loc>${u}</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;}
  return rows?s.replace('</urlset>',rows+'</urlset>'):s;
});
