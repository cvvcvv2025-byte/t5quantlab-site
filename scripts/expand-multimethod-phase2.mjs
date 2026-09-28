import fs from 'node:fs';

function edit(file, fn){
  let s=fs.readFileSync(file,'utf8');
  const before=s;
  s=fn(s);
  if(s!==before){fs.writeFileSync(file,s);console.log('updated',file)} else console.log('no change',file);
}
const replaceAll=(s,a,b)=>s.split(a).join(b);

edit('index.html',s=>{
  s=replaceAll(s,'132题多方法互动训练','156题多方法训练');
  s=replaceAll(s,'132题多方法训练','156题多方法训练');
  s=replaceAll(s,'<b>132</b>多方法训练题','<b>156</b>多方法训练题');
  s=replaceAll(s,'132题多方法互动训练 <span>→</span>','156题多方法训练入口 <span>→</span>');
  s=replaceAll(s,'<b>132</b><span>可判分训练题</span>','<b>156</b><span>多方法公开训练题</span>');
  s=replaceAll(s,'<b>8</b><span>训练专题包</span>','<b>9</b><span>训练专题 / 应用包</span>');
  s=replaceAll(s,'18本/套专项资料，把参数用法追溯到指标设计、系统构建和验证。','专项书单 + 组合/失效/EA路线，把指标从参数用法推进到系统验证。');
  return s;
});

edit('library/index.html',s=>{
  s=replaceAll(s,'132题训练','156题训练');
  s=replaceAll(s,'现在是132题多方法训练器。','现在有156题多方法训练。');
  s=replaceAll(s,'新增36题Indicator Foundations。旧进度ID不变，指标用户不再需要先做SMC题。','新增36题Indicator Foundations + 24题Indicator Applied；旧96题继续保留，指标用户不再需要先做SMC题。');
  const marker='<a class="feature-row" href="/market-lab/practice/indicator-foundations/"><div class="feature-index">36Q</div><div><h3>Indicator Foundations</h3><p>均线、MACD、RSI、Bollinger、ADX、Stochastic、Ichimoku、ATR、VWAP等。</p></div></a>';
  if(s.includes(marker)&&!s.includes('/market-lab/practice/indicator-applied/')){
    s=s.replace(marker,marker+'<a class="feature-row" href="/market-lab/practice/indicator-applied/"><div class="feature-index">24Q</div><div><h3>Indicator Applied</h3><p>组合职责、失效Regime、多周期、风险、过拟合与EA状态。</p></div></a>');
  }
  return s;
});

edit('market-lab/index.html',s=>{
  s=replaceAll(s,'132道多方法训练题','156道多方法训练题');
  s=replaceAll(s,'132道多方法训练','156道多方法训练');
  s=replaceAll(s,'当前132题已经分成传统指标与原有Structure/PA/SMC/Risk/EA两条主线。','当前156题分成指标基础、指标应用，以及原有Structure/PA/SMC/Risk/EA三条主线。');
  s=replaceAll(s,'开始132题训练','进入156题训练中心');
  s=replaceAll(s,'<b>132</b><span>PUBLIC DRILLS</span>','<b>156</b><span>PUBLIC DRILLS</span>');
  s=replaceAll(s,'<b>8</b><span>TOPIC PACKS</span>','<b>9</b><span>TOPIC / APPLIED PACKS</span>');
  s=replaceAll(s,'132题只是第二阶段，不是终点。','156题仍只是当前阶段，不是终点。');
  s=replaceAll(s,'<b>132</b><span>公开可判分题</span>','<b>156</b><span>公开训练题</span>');
  s=replaceAll(s,'<b>8</b><span>专题包</span>','<b>9</b><span>专题 / 应用包</span>');
  const old='<div class="path-panel trade"><div class="path-label">01 / INDICATOR FOUNDATIONS</div><h2>36题传统指标训练</h2><p>每题都带指标快照，覆盖趋势、动量、波动率、量价和组合冗余，不要求脑补图表。</p>';
  if(s.includes(old)) s=s.replace(old,'<div class="path-panel trade"><div class="path-label">01 / INDICATOR TRACK</div><h2>60题指标训练：基础36 + 应用24</h2><p>基础题先搞清指标测什么；应用题再练组合职责、失效环境、多周期、风险与EA状态。</p>');
  s=replaceAll(s,'<a class="btn hero-primary" href="/market-lab/practice/indicator-foundations/">查看36题</a>','<a class="btn hero-primary" href="/market-lab/practice/indicator-foundations/">基础36题</a><a class="btn hero-secondary" href="/market-lab/practice/indicator-applied/">应用24题</a>');
  const prog='<div class="progress-line"><div class="progress-meta"><span>Indicator Foundations</span><span>36题</span></div><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div></div>';
  if(s.includes(prog)&&!s.includes('Indicator Applied</span><span>24题')) s=s.replace(prog,prog+'<div class="progress-line"><div class="progress-meta"><span>Indicator Applied</span><span>24题</span></div><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div></div>');
  return s;
});

edit('library/indicators/index.html',s=>{
  s=replaceAll(s,'36题指标训练','基础36题');
  s=replaceAll(s,'18本指标专项书单','指标专项书单');
  const anchor='<section class="section alt"><div class="container"><div class="head"><h2>指标组合不是“越多越安全”</h2>';
  if(s.includes(anchor)&&!s.includes('/library/indicators/indicator-combinations/')){
    const block='<section class="section"><div class="container"><div class="head"><h2>从单指标进入策略层</h2><p>学会公式只是第一层。下一步要解决组合职责、失效环境，以及怎样把主观说法冻结成EA规则。</p></div><div class="indicator-grid"><a class="indicator-card" href="/library/indicators/indicator-combinations/"><small>COMBINATION</small><h3>指标组合与职责分工</h3><p>趋势、动量、波动率、位置、参与度怎样跨维度组合，避免伪共振。</p><div class="good">Role Freeze / Ablation</div></a><a class="indicator-card" href="/library/indicators/failure-regimes/"><small>REGIME</small><h3>指标失效环境</h3><p>趋势、震荡、压缩、扩张、新闻与低流动性环境下哪些读法会失真。</p><div class="warn">No Universal Indicator</div></a><a class="indicator-card" href="/library/indicators/indicator-to-ea/"><small>ENGINEERING</small><h3>Indicator → EA</h3><p>Signal、Entry、State、Risk、Parity与Audit怎样程序化。</p><div class="good">Rule Freeze / State</div></a><a class="indicator-card" href="/market-lab/practice/indicator-applied/"><small>24 APPLIED</small><h3>进阶应用题</h3><p>不再考公式定义，直接考组合、Regime、多周期、过拟合和执行状态。</p><div class="good">Scenario Training</div></a></div></div></section>';
    s=s.replace(anchor,block+anchor);
  }
  return s;
});

edit('sitemap.xml',s=>{
  const urls=[
    'https://t5quantlab.com/library/indicators/indicator-combinations/',
    'https://t5quantlab.com/library/indicators/failure-regimes/',
    'https://t5quantlab.com/library/indicators/indicator-to-ea/',
    'https://t5quantlab.com/market-lab/practice/indicator-applied/'
  ];
  let rows='';
  for(const u of urls) if(!s.includes(`<loc>${u}</loc>`)) rows+=`  <url><loc>${u}</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;
  return rows?s.replace('</urlset>',rows+'</urlset>'):s;
});
