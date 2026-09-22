(function(){
  const STORE='t5_liquidity_real20_v1';
  const q=new URLSearchParams(location.search);
  const preview=q.get('preview')==='1';
  let raw={};try{raw=JSON.parse(localStorage.getItem(STORE)||'{}')}catch(_){raw={}}
  const rows=Object.entries(raw).filter(([,r])=>r&&typeof r.score==='number').map(([id,r])=>({id:Number(id),...r})).sort((a,b)=>a.id-b.id);
  const data=preview?makePreview():rows;
  if(!preview&&data.length<20){
    document.querySelector('.result-shell').innerHTML='<section class="container"><div class="locked-state"><div class="section-label">BASELINE NOT COMPLETE</div><h1>先完成20题，再生成这份诊断。</h1><p>这页不会根据几道题就假装判断你的能力。完成 Liquidity 基线以后，系统才会生成本轮弱点与下一步训练建议。</p><a class="result-cta" href="/training/liquidity/">继续完成训练 →</a><a class="text-link" href="/training/liquidity/result/?preview=1">仅查看结果页设计预览</a></div></section>';
    return;
  }
  function makePreview(){
    const scores=[100,100,60,100,60,0,100,60,100,60,0,100,60,100,0,60,100,0,60,0];
    return scores.map((score,i)=>({id:i+1,score,side:i%2?'sell':'buy',centerGap:[.18,.32,.61,.25,.74,1.62][i%6],widthRatio:[1.05,1.22,1.85,.94,2.7,.72][i%6]}));
  }
  const mean=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):null;
  const avg=mean(data.map(x=>x.score));
  const buys=data.filter(x=>x.side==='buy'),sells=data.filter(x=>x.side==='sell');
  const buy=mean(buys.map(x=>x.score)),sell=mean(sells.map(x=>x.score));
  const exact=data.filter(x=>x.score===100).length,near=data.filter(x=>x.score===60).length,miss=data.filter(x=>x.score===0).length;
  const wide=data.filter(x=>(x.widthRatio||0)>2.2).length;
  const narrow=data.filter(x=>(x.widthRatio||99)<.75).length;
  const cg=data.filter(x=>typeof x.centerGap==='number').map(x=>x.centerGap);
  const center=cg.length?(cg.reduce((a,b)=>a+b,0)/cg.length).toFixed(2):'—';
  let issue='区域精度仍有提升空间',detail='你的主要问题不是“完全看不见流动性”，而是一些场景里区域定位仍不稳定。下一轮应该用新的陌生行情继续复测，而不是重做这20题。',focus='Liquidity Priority + 区域精度';
  if(buy!==null&&sell!==null&&buy+10<sell){issue='Buy-side 外部流动性识别明显偏弱';detail='你对下方外部流动性的判断更稳定，但上方区域更容易出现偏移。下一轮应优先训练 Buy-side Priority，并继续检查区域宽度。';focus='Buy-side Priority';}
  else if(buy!==null&&sell!==null&&sell+10<buy){issue='Sell-side 外部流动性识别明显偏弱';detail='你对上方外部流动性的判断更稳定，但下方区域更容易出现偏移。下一轮应优先训练 Sell-side Priority，并继续检查区域宽度。';focus='Sell-side Priority';}
  else if(wide>=5){issue='你经常把流动性区域框得过宽';detail='方向感不是主要矛盾。你更容易把整片价格区都当成答案，这会削弱后续 Entry 和 Risk 的精度。';focus='Liquidity Precision';}
  else if(narrow>=5){issue='你经常把流动性区域框得过窄';detail='你能接近关键位置，但容易把答案收得太紧，忽略真实摆动高低点之间允许的价格带。';focus='Zone Width Control';}
  document.getElementById('avgScore').textContent=avg??'—';
  document.getElementById('buyScore').textContent=buy??'—';
  document.getElementById('sellScore').textContent=sell??'—';
  document.getElementById('distribution').textContent=`${exact} / ${near} / ${miss}`;
  document.getElementById('wideCount').textContent=wide;
  document.getElementById('narrowCount').textContent=narrow;
  document.getElementById('centerGap').textContent=center==='—'?'—':center;
  document.getElementById('primaryIssue').textContent=issue;
  document.getElementById('primaryDetail').textContent=detail;
  document.getElementById('focusLabel').textContent=`优先：${focus}`;
  document.getElementById('nextTitle').textContent=`下一轮先练：${focus}`;
  document.getElementById('nextDetail').textContent='不重做旧题。用新的陌生场景重新测试同一弱点，只有在新行情里稳定，才算真的改善。';
  let tone='这是一条基线，不是成绩单。';if(avg>=80)tone='整体识别较稳定，但仍要用新的陌生行情验证是否可重复。';else if(avg>=60)tone='你已经能识别一部分关键区域，但稳定性不足。';else tone='当前结果说明基础判断仍不稳定，继续堆复杂策略没有意义。';
  document.getElementById('scoreText').textContent=tone;
  const weak=[...data].sort((a,b)=>(a.score-b.score)||((b.centerGap||0)-(a.centerGap||0))).slice(0,3);
  const box=document.getElementById('weakCases');box.innerHTML='';weak.forEach(r=>{const div=document.createElement('div');div.className='weak-row';div.innerHTML=`<div><b>Scenario #${String(r.id).padStart(2,'0')}</b><span>${r.side==='buy'?'Buy-side':'Sell-side'}</span></div><b>${r.score}/100</b>`;box.appendChild(div)});
  document.getElementById('backTraining').onclick=()=>{location.href='/training/liquidity/'};
})();