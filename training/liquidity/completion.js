(function(){
  const STORE='t5_liquidity_real20_v1';
  const SEEN='t5_liquidity_offer_seen_v1';
  const cases=window.T5_CASES||[];
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(_){return{}}}
  function doneRows(){const s=state();return cases.filter(c=>s[c.id]&&typeof s[c.id].score==='number').map(c=>({c,r:s[c.id]}))}
  function avg(rows){return rows.length?Math.round(rows.reduce((n,x)=>n+x.r.score,0)/rows.length):null}
  function sideAvg(rows,side){return avg(rows.filter(x=>x.c.side===side))}
  function summary(preview=false){
    if(preview)return{avg:71,buy:78,sell:64,exact:8,near:7,miss:5,primary:'Sell-side 外部流动性识别偏弱',detail:'你的上方流动性判断较稳定，但下方外部流动性更容易出现区域偏移。下一轮应优先练 Sell-side Priority，而不是继续随机刷题。'};
    const rows=doneRows(),vals=rows.map(x=>x.r.score),buy=sideAvg(rows,'buy'),sell=sideAvg(rows,'sell');
    let primary='区域精度仍有提升空间',detail='下一轮优先复盘低分题，并用新的陌生行情重新测试，避免只记住这20题的答案。';
    if(buy!==null&&sell!==null&&buy+10<sell){primary='Buy-side 外部流动性识别偏弱';detail='你的下方流动性判断更稳定。下一轮应优先练 Buy-side Priority 与上方区域精度。'}
    else if(buy!==null&&sell!==null&&sell+10<buy){primary='Sell-side 外部流动性识别偏弱';detail='你的上方流动性判断更稳定。下一轮应优先练 Sell-side Priority 与下方区域精度。'}
    else {const wide=rows.filter(x=>(x.r.widthRatio||0)>2.2).length;if(wide>=Math.max(3,Math.ceil(rows.length*.25))){primary='你经常把流动性区域框得过宽';detail='方向并非主要问题。下一轮更应该训练“主要流动性区域的精度”，减少把整片价格区都当成答案。'}}
    return{avg:avg(rows),buy,sell,exact:vals.filter(v=>v===100).length,near:vals.filter(v=>v===60).length,miss:vals.filter(v=>v===0).length,primary,detail};
  }
  function modalMarkup(m){return `<div class="offer-backdrop" id="offerBackdrop" role="dialog" aria-modal="true" aria-labelledby="offerTitle">
    <div class="offer-modal">
      <button class="offer-close" id="offerClose" aria-label="关闭">×</button>
      <div class="offer-badge">20 / 20 · 免费测试完成</div>
      <div class="offer-grid">
        <div class="offer-result">
          <div class="section-label">YOUR FIRST DECISION PROFILE</div>
          <h2 id="offerTitle">你已经找到第一组真实弱点。</h2>
          <p class="offer-lead">免费测试回答的是：<b>你现在哪里不稳定。</b><br>接下来的价值，不是再给你一堆随机题，而是持续决定<b>你下一步最该练什么</b>。</p>
          <div class="offer-score-grid">
            <div><span>Liquidity 过程分</span><strong>${m.avg??'—'}</strong></div>
            <div><span>Buy-side</span><strong>${m.buy??'—'}</strong></div>
            <div><span>Sell-side</span><strong>${m.sell??'—'}</strong></div>
          </div>
          <div class="offer-diagnosis"><small>当前主要问题</small><b>${m.primary}</b><p>${m.detail}</p></div>
          <div class="offer-dist">精确 ${m.exact} · 接近 ${m.near} · 偏离 ${m.miss}</div>
        </div>
        <div class="offer-plan">
          <span class="offer-plan-label">T5 PRO · 即将开放</span>
          <h3>不是“解锁更多题”，而是进入持续训练闭环。</h3>
          <div class="offer-benefit"><i>01</i><div><b>新的真实市场场景</b><span>持续加入陌生行情，不靠重复记忆旧答案。</span></div></div>
          <div class="offer-benefit"><i>02</i><div><b>弱项优先训练</b><span>训练顺序根据你的错误画像调整，而不是随机刷题。</span></div></div>
          <div class="offer-benefit"><i>03</i><div><b>真实交易截图复盘</b><span>把实盘里的错误写回画像，再自动关联下一轮训练。</span></div></div>
          <div class="offer-benefit"><i>04</i><div><b>长期 Decision Profile</b><span>跟踪同类错误有没有真正减少；Pro+ 再把规则带回实盘图表。</span></div></div>
          <div class="offer-actions"><a class="lab-btn primary offer-primary" href="/pricing/?from=liquidity-complete">查看 Pro 订阅权益 →</a><button class="lab-btn secondary" id="offerReport">先看完整免费诊断</button></div>
          <p class="offer-note">当前为产品预览阶段，订阅付款尚未开放，不会产生扣费。</p>
        </div>
      </div>
    </div>
  </div>`}
  function openOffer(preview=false){
    const old=document.getElementById('offerBackdrop');if(old)old.remove();
    document.body.insertAdjacentHTML('beforeend',modalMarkup(summary(preview)));
    document.body.classList.add('offer-open');
    const close=()=>{document.getElementById('offerBackdrop')?.remove();document.body.classList.remove('offer-open')};
    document.getElementById('offerClose').onclick=close;
    document.getElementById('offerBackdrop').addEventListener('click',e=>{if(e.target.id==='offerBackdrop')close()});
    document.getElementById('offerReport').onclick=()=>{close();document.getElementById('report')?.scrollIntoView({behavior:'smooth',block:'start'})};
  }
  function ensureReportCTA(){
    if(document.getElementById('openOfferBtn'))return;
    const warning=document.querySelector('#report .report-warning');if(!warning)return;
    const box=document.createElement('div');box.className='report-offer-cta';box.innerHTML='<div><b>免费测试已结束</b><span>继续训练的重点应该来自你的弱点，而不是再随机找题。</span></div><button id="openOfferBtn" class="lab-btn primary">查看 Pro 训练闭环</button>';
    warning.before(box);document.getElementById('openOfferBtn').onclick=()=>openOffer(false);
  }
  function maybeComplete(){
    if(cases.length<20||doneRows().length<20)return;
    ensureReportCTA();
    if(localStorage.getItem(SEEN)!=='1'){
      localStorage.setItem(SEEN,'1');
      setTimeout(()=>openOffer(false),850);
    }
  }
  const submit=document.getElementById('submitBtn');if(submit)submit.addEventListener('click',()=>setTimeout(maybeComplete,700));
  const reportBtn=document.getElementById('reportBtn');if(reportBtn)reportBtn.addEventListener('click',()=>setTimeout(()=>{if(doneRows().length>=20)ensureReportCTA()},120));
  if(new URLSearchParams(location.search).get('offer')==='preview')setTimeout(()=>openOffer(true),450);
  setTimeout(maybeComplete,900);
})();
