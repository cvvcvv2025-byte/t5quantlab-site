import fs from 'node:fs';

function edit(file, fn){
  let s=fs.readFileSync(file,'utf8');
  const before=s;
  s=fn(s);
  if(s!==before){fs.writeFileSync(file,s);console.log('updated',file)} else console.log('no change',file);
}
const all=(s,a,b)=>s.split(a).join(b);

edit('index.html',s=>{
  s=all(s,'156题多方法训练','216题多方法公开训练');
  s=all(s,'<b>156</b>多方法训练题','<b>216</b>公开训练题');
  s=all(s,'<b>156</b><span>多方法公开训练题</span>','<b>216</b><span>公开训练题</span>');
  s=all(s,'<b>9</b><span>训练专题 / 应用包</span>','<b>13</b><span>训练专题 / 专项包</span>');
  const needle='<a href="/market-lab/practice/trainer/">156题多方法训练入口 <span>→</span></a>';
  if(s.includes(needle)) s=s.replace(needle,'<a href="/market-lab/practice/trainer/">132题统一训练器 <span>→</span></a><a href="/market-lab/practice/classic-ta-applied/">Classic TA 24题 <span>→</span></a><a href="/market-lab/practice/macd-specialist/">MACD / Bollinger / RSI专项 <span>→</span></a>');
  return s;
});

edit('library/index.html',s=>{
  s=all(s,'156题训练','216题公开训练');
  s=all(s,'现在有156题多方法训练。','现在有216题多方法公开训练。');
  s=all(s,'新增36题Indicator Foundations + 24题Indicator Applied；旧96题继续保留，指标用户不再需要先做SMC题。','132题统一训练器保持旧进度；另有84题专项包：Indicator Applied 24、Classic TA 24、MACD/Bollinger/RSI各12。');
  const cta='<a class="btn" href="/market-lab/practice/trainer/">156题训练</a>';
  if(s.includes(cta)) s=s.replace(cta,'<a class="btn" href="/market-lab/">216题训练中心</a>');
  return s;
});

edit('market-lab/index.html',s=>{
  s=all(s,'156道多方法训练题','216道多方法公开训练题');
  s=all(s,'156道多方法训练','216道多方法公开训练');
  s=all(s,'当前156题分成指标基础、指标应用，以及原有Structure/PA/SMC/Risk/EA三条主线。','当前216题分成132题统一训练器与84题独立专项包。统一训练器保留旧进度；专项包继续扩展Classic TA与具体指标。');
  s=all(s,'进入156题训练中心','进入216题训练中心');
  s=all(s,'<b>156</b><span>PUBLIC DRILLS</span>','<b>216</b><span>PUBLIC DRILLS</span>');
  s=all(s,'<b>9</b><span>TOPIC / APPLIED PACKS</span>','<b>13</b><span>TOPIC / SPECIALIST PACKS</span>');
  s=all(s,'156题仍只是当前阶段，不是终点。','216题仍只是当前阶段，不是终点。');
  s=all(s,'<b>156</b><span>公开训练题</span>','<b>216</b><span>公开训练题</span>');
  s=all(s,'<b>9</b><span>专题 / 应用包</span>','<b>13</b><span>专题 / 专项包</span>');
  const old='<div class="path-panel trade"><div class="path-label">01 / INDICATOR TRACK</div><h2>60题指标训练：基础36 + 应用24</h2><p>基础题先搞清指标测什么；应用题再练组合职责、失效环境、多周期、风险与EA状态。</p>';
  if(s.includes(old)) s=s.replace(old,'<div class="path-panel trade"><div class="path-label">01 / INDICATOR TRACK</div><h2>96题指标训练：基础36 + 应用24 + 三个专项36</h2><p>先学指标测什么，再进入MACD、Bollinger、RSI专项；重点训练Regime、组合、状态、参数和失效。</p>');
  const applied='<a class="btn hero-secondary" href="/market-lab/practice/indicator-applied/">应用24题</a>';
  if(s.includes(applied)&&!s.includes('/market-lab/practice/macd-specialist/')) s=s.replace(applied,applied+'<a class="btn hero-secondary" href="/market-lab/practice/macd-specialist/">MACD 12</a><a class="btn hero-secondary" href="/market-lab/practice/bollinger-specialist/">Bollinger 12</a><a class="btn hero-secondary" href="/market-lab/practice/rsi-specialist/">RSI 12</a>');
  const next='<div class="feature-list">';
  if(s.includes(next)&&!s.includes('/market-lab/practice/classic-ta-applied/')) s=s.replace(next,next+'<a class="feature-row" href="/market-lab/practice/classic-ta-applied/"><div class="feature-index">24Q</div><div><h3>Classic Technical Analysis</h3><p>支撑阻力、趋势线、通道、经典形态、突破与失败。</p></div></a><a class="feature-row" href="/market-lab/practice/macd-specialist/"><div class="feature-index">12Q</div><div><h3>MACD Specialist</h3><p>零轴、Histogram、背离、多周期、参数与EA。</p></div></a><a class="feature-row" href="/market-lab/practice/bollinger-specialist/"><div class="feature-index">12Q</div><div><h3>Bollinger Specialist</h3><p>Squeeze、BandWidth、Walk the Band与均值回归。</p></div></a><a class="feature-row" href="/market-lab/practice/rsi-specialist/"><div class="feature-index">12Q</div><div><h3>RSI Specialist</h3><p>Range Shift、钝化、背离、区间与规则冻结。</p></div></a>');
  return s;
});

edit('library/classic-technical-analysis/index.html',s=>{
  const start='<section class="section" id="map"><div class="container"><div class="head"><h2>经典技术分析学习地图</h2></div><div class="indicator-grid">';
  if(s.includes(start)&&!s.includes('/library/classic-technical-analysis/support-resistance/')){
    s=s.replace(start,start+'<a class="indicator-card" href="/library/classic-technical-analysis/support-resistance/"><small>CORE MODULE</small><h3>支撑阻力与角色转换</h3><p>区域、Freshness、Approach、Break、Role Reversal。</p></a><a class="indicator-card" href="/library/classic-technical-analysis/trendlines-channels/"><small>CORE MODULE</small><h3>趋势线与通道</h3><p>锚点、斜率、第三次验证、加速、破线与重画偏差。</p></a><a class="indicator-card" href="/library/classic-technical-analysis/chart-patterns/"><small>CORE MODULE</small><h3>图表形态</h3><p>双顶底、头肩、三角、旗形、矩形、楔形的完成与失效。</p></a><a class="indicator-card" href="/library/classic-technical-analysis/breakout-failure/"><small>CORE MODULE</small><h3>突破与失败突破</h3><p>Break、Acceptance、Retest、Reclaim与Failed Break。</p></a>');
  }
  s=all(s,'href="/market-lab/practice/trainer/">进入训练器','href="/market-lab/practice/classic-ta-applied/">Classic TA 24题');
  return s;
});

for(const [file,route,label] of [
 ['library/indicators/macd/index.html','/market-lab/practice/macd-specialist/','MACD专项12题'],
 ['library/indicators/bollinger-bands/index.html','/market-lab/practice/bollinger-specialist/','Bollinger专项12题'],
 ['library/indicators/rsi/index.html','/market-lab/practice/rsi-specialist/','RSI专项12题']
]) edit(file,s=>{
  if(s.includes(route)) return s;
  const marker='</main>';
  const block=`<section class="section alt"><div class="container"><div class="head"><h2>专项训练</h2><p>读完教材后不要停在“看懂”。用独立题包检查Regime、失效、多周期、参数和EA定义。</p></div><div class="actions"><a class="btn primary" href="${route}">${label}</a><a class="btn" href="/market-lab/practice/indicator-applied/">Indicator Applied 24题</a></div></div></section>`;
  return s.replace(marker,block+marker);
});

edit('sitemap.xml',s=>{
  const urls=[
    '/library/classic-technical-analysis/support-resistance/',
    '/library/classic-technical-analysis/trendlines-channels/',
    '/library/classic-technical-analysis/chart-patterns/',
    '/library/classic-technical-analysis/breakout-failure/',
    '/market-lab/practice/classic-ta-applied/',
    '/market-lab/practice/macd-specialist/',
    '/market-lab/practice/bollinger-specialist/',
    '/market-lab/practice/rsi-specialist/'
  ];
  let rows='';
  for(const r of urls){const u='https://t5quantlab.com'+r;if(!s.includes(`<loc>${u}</loc>`))rows+=`  <url><loc>${u}</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;}
  return rows?s.replace('</urlset>',rows+'</urlset>'):s;
});
