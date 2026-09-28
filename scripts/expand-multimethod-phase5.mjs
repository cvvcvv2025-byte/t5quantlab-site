import fs from 'node:fs';

function edit(file, fn){
  let s=fs.readFileSync(file,'utf8');
  const before=s;
  s=fn(s);
  if(s!==before){fs.writeFileSync(file,s);console.log('updated',file)} else console.log('no change',file);
}
const all=(s,a,b)=>s.split(a).join(b);

edit('index.html',s=>{
  s=all(s,'288题多方法公开训练','324题多方法公开训练');
  s=all(s,'<b>288</b>公开训练题','<b>324</b>公开训练题');
  s=all(s,'<b>288</b><span>公开训练题</span>','<b>324</b><span>公开训练题</span>');
  s=all(s,'<b>19</b><span>训练专题 / 专项包</span>','<b>22</b><span>训练专题 / 专项包</span>');
  return s;
});

edit('library/index.html',s=>{
  s=all(s,'288题公开训练','324题公开训练');
  s=all(s,'现在有288题多方法公开训练。','现在有324题多方法公开训练。');
  s=all(s,'132题统一训练器保持旧进度；另有156题专项包，覆盖Classic TA与九组传统指标专项。','132题统一训练器保持旧进度；另有192题专项包，覆盖Classic TA与12个传统指标家族。');
  return s;
});

edit('market-lab/index.html',s=>{
  s=all(s,'288道多方法公开训练题','324道多方法公开训练题');
  s=all(s,'288道多方法公开训练','324道多方法公开训练');
  s=all(s,'当前288题分成132题统一训练器与156题独立专项包。统一训练器保留旧进度；专项包覆盖Classic TA与九组传统指标。','当前324题分成132题统一训练器与192题独立专项包。统一训练器保留旧进度；12个传统指标家族全部拥有独立专项。');
  s=all(s,'进入288题训练中心','进入324题训练中心');
  s=all(s,'<b>288</b><span>PUBLIC DRILLS</span>','<b>324</b><span>PUBLIC DRILLS</span>');
  s=all(s,'<b>19</b><span>TOPIC / SPECIALIST PACKS</span>','<b>22</b><span>TOPIC / SPECIALIST PACKS</span>');
  s=all(s,'288题仍只是当前阶段，不是终点。','324题仍只是当前阶段，不是终点。');
  s=all(s,'<b>288</b><span>公开训练题</span>','<b>324</b><span>公开训练题</span>');
  s=all(s,'<b>19</b><span>专题 / 专项包</span>','<b>22</b><span>专题 / 专项包</span>');
  s=all(s,'168题指标训练：基础36 + 应用24 + 九个专项108','204题指标训练：基础36 + 应用24 + 十二个专项144');
  s=all(s,'先学指标测什么，再进入MACD、Bollinger、RSI、MA、ADX、Stochastic、Ichimoku、Volume与Volatility专项。','先学指标测什么，再进入12个指标家族专项；所有模块都覆盖Regime、参数、失效、多周期和EA边界。');
  if(!s.includes('/market-lab/practice/momentum-oscillators-specialist/')){
    const marker='<a class="feature-row" href="/market-lab/practice/volatility-channels-specialist/"';
    if(s.includes(marker)){
      const p=s.indexOf(marker), e=s.indexOf('</a>',p)+4;
      const extra='<a class="feature-row" href="/market-lab/practice/momentum-oscillators-specialist/"><div class="feature-index">12Q</div><div><h3>CCI / ROC / Momentum / %R Specialist</h3><p>极值、零轴、背离、尺度、Regime与参数稳定性。</p></div></a><a class="feature-row" href="/market-lab/practice/trend-following-tools-specialist/"><div class="feature-index">12Q</div><div><h3>Supertrend / PSAR Specialist</h3><p>趋势跟踪、Trail、Whipsaw、事件优先级和执行。</p></div></a><a class="feature-row" href="/market-lab/practice/pivot-points-specialist/"><div class="feature-index">12Q</div><div><h3>Pivot Points Specialist</h3><p>Session、Role Reversal、公式体系、DST与Parity。</p></div></a>';
      s=s.slice(0,e)+extra+s.slice(e);
    }
  }
  return s;
});

edit('library/indicators/index.html',s=>{
  if(!s.includes('/market-lab/practice/momentum-oscillators-specialist/')){
    const marker='<section class="section alt"><div class="container"><div class="head"><h2>指标组合不是“越多越安全”</h2>';
    const block='<section class="section"><div class="container"><div class="head"><h2>最后三组专项也已补齐</h2><p>现在12个指标家族全部都有独立专项训练。</p></div><div class="indicator-grid"><a class="indicator-card" href="/market-lab/practice/momentum-oscillators-specialist/"><small>12Q</small><h3>CCI / ROC / Momentum / %R</h3><p>极值、背离、尺度、Regime与信息冗余。</p></a><a class="indicator-card" href="/market-lab/practice/trend-following-tools-specialist/"><small>12Q</small><h3>Supertrend / PSAR</h3><p>趋势跟踪、Trail、Whipsaw、参数与事件优先级。</p></a><a class="indicator-card" href="/market-lab/practice/pivot-points-specialist/"><small>12Q</small><h3>Pivot Points</h3><p>Session、Role Reversal、Confluence、DST与EA Parity。</p></a></div></div></section>';
    if(s.includes(marker)) s=s.replace(marker,block+marker);
  }
  return s;
});

for(const [file,route,label] of [
 ['library/indicators/momentum-oscillators/index.html','/market-lab/practice/momentum-oscillators-specialist/','CCI / ROC / Momentum / %R专项12题'],
 ['library/indicators/trend-following-tools/index.html','/market-lab/practice/trend-following-tools-specialist/','Supertrend / PSAR专项12题'],
 ['library/indicators/pivot-points/index.html','/market-lab/practice/pivot-points-specialist/','Pivot Points专项12题']
]) edit(file,s=>{
  if(s.includes(route)) return s;
  const block=`<section class="section alt"><div class="container"><div class="head"><h2>专项训练</h2><p>读完教材后用12道场景题检查Regime、参数、失效、执行与EA状态。</p></div><div class="actions"><a class="btn primary" href="${route}">${label}</a><a class="btn" href="/market-lab/practice/indicator-applied/">Indicator Applied 24题</a></div></div></section>`;
  return s.replace('</main>',block+'</main>');
});

edit('sitemap.xml',s=>{
  const routes=[
    '/market-lab/practice/momentum-oscillators-specialist/',
    '/market-lab/practice/trend-following-tools-specialist/',
    '/market-lab/practice/pivot-points-specialist/'
  ];
  let rows='';
  for(const r of routes){const u='https://t5quantlab.com'+r;if(!s.includes(`<loc>${u}</loc>`)) rows+=`  <url><loc>${u}</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;}
  return rows?s.replace('</urlset>',rows+'</urlset>'):s;
});
