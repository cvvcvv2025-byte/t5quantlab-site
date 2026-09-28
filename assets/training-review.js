(()=>{
const STORE='t5_specialist_progress_v1';
const PACKS=[
['/market-lab/practice/indicator-foundations/','Indicator Foundations',36,'FOUNDATION'],
['/market-lab/practice/indicator-applied/','Indicator Applied',24,'INDICATOR'],
['/market-lab/practice/classic-ta-applied/','Classic TA Applied',24,'CLASSIC TA'],
['/market-lab/practice/macd-specialist/','MACD Specialist',12,'INDICATOR'],
['/market-lab/practice/bollinger-specialist/','Bollinger Specialist',12,'INDICATOR'],
['/market-lab/practice/rsi-specialist/','RSI Specialist',12,'INDICATOR'],
['/market-lab/practice/moving-averages-specialist/','Moving Averages Specialist',12,'INDICATOR'],
['/market-lab/practice/adx-dmi-specialist/','ADX / DMI Specialist',12,'INDICATOR'],
['/market-lab/practice/stochastic-specialist/','Stochastic Specialist',12,'INDICATOR'],
['/market-lab/practice/ichimoku-specialist/','Ichimoku Specialist',12,'INDICATOR'],
['/market-lab/practice/volume-indicators-specialist/','VWAP / OBV / MFI Specialist',12,'VOLUME'],
['/market-lab/practice/volatility-channels-specialist/','ATR / Keltner / Donchian',12,'VOLATILITY'],
['/market-lab/practice/momentum-oscillators-specialist/','Momentum Oscillators',12,'MOMENTUM'],
['/market-lab/practice/trend-following-tools-specialist/','Supertrend / PSAR',12,'TREND'],
['/market-lab/practice/pivot-points-specialist/','Pivot Points Specialist',12,'CLASSIC TA'],
['/market-lab/practice/fibonacci-specialist/','Fibonacci Specialist',24,'LOCATION'],
['/market-lab/practice/volume-profile-specialist/','Volume Profile Specialist',24,'AUCTION'],
['/market-lab/practice/risk-management-specialist/','Risk Management Specialist',24,'RISK'],
['/market-lab/practice/strategy-families-specialist/','Strategy Families Specialist',24,'SYSTEM']
];
let db={};try{db=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{db={}};
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const rows=PACKS.map(([path,name,total,group])=>{const rec=db[path]||{};const vals=Object.entries(rec).filter(([,r])=>r&&r.attempted);const attempted=vals.length,first=vals.filter(([,r])=>r.firstCorrect).length,mastered=vals.filter(([,r])=>r.mastered).length,pending=vals.filter(([,r])=>!r.mastered).length,repaired=vals.filter(([,r])=>r.repaired).length,accuracy=attempted?Math.round(first/attempted*100):null;return{path,name,total,group,rec,vals,attempted,first,mastered,pending,repaired,accuracy,untouched:Math.max(0,total-attempted)}});
const all=rows.flatMap(r=>r.vals.map(([id,x])=>({pack:r,id,...x})));const attempted=all.length,first=all.filter(x=>x.firstCorrect).length,mastered=all.filter(x=>x.mastered).length,pending=all.filter(x=>!x.mastered).length,repaired=all.filter(x=>x.repaired).length,accuracy=attempted?Math.round(first/attempted*100):null;
if($('rvAttempted'))$('rvAttempted').textContent=`${attempted}/324`;if($('rvMastered'))$('rvMastered').textContent=mastered;if($('rvPending'))$('rvPending').textContent=pending;if($('rvAccuracy'))$('rvAccuracy').textContent=accuracy==null?'—':accuracy+'%';if($('rvRepaired'))$('rvRepaired').textContent=repaired;
function packCard(r){const pct=Math.round(r.attempted/r.total*100),cls=r.pending?'weak':r.attempted&&r.mastered===r.attempted?'clean':'';return `<article class="pack-card ${cls}" data-pack="${safe(r.path)}"><div class="pack-head"><div><h3>${safe(r.name)}</h3><small>${safe(r.group)}</small></div><span class="pack-tag">${r.total}Q</span></div><div class="pack-metrics"><div><b>${r.attempted}</b><span>已答</span></div><div><b>${r.mastered}</b><span>已掌握</span></div><div><b>${r.pending}</b><span>待修复</span></div><div><b>${r.accuracy==null?'—':r.accuracy+'%'}</b><span>首次正确</span></div></div><div class="bar"><i style="width:${pct}%"></i></div><div class="pack-actions"><a class="btn" href="${r.path}">${r.untouched?'继续训练':'打开专项'}</a>${r.pending?`<a class="btn" href="${r.path}?filter=wrong">修复错题 ${r.pending}</a>`:''}</div></article>`}
function renderPacks(mode='priority'){let x=[...rows];if(mode==='priority')x.sort((a,b)=>b.pending-a.pending||(a.accuracy??101)-(b.accuracy??101)||b.attempted-a.attempted);if(mode==='incomplete')x=x.filter(r=>r.attempted<r.total);if(mode==='wrong')x=x.filter(r=>r.pending>0).sort((a,b)=>b.pending-a.pending||(a.accuracy??101)-(b.accuracy??101));if(mode==='mastered')x=x.filter(r=>r.attempted>0&&r.pending===0&&r.mastered===r.attempted);$('packGrid').innerHTML=x.length?x.map(packCard).join(''):'<div class="empty">当前筛选没有对应专项。</div>'}
function renderWrong(){const list=all.filter(x=>!x.mastered).sort((a,b)=>b.attempts-a.attempts||a.pack.name.localeCompare(b.pack.name));$('wrongCount').textContent=list.length;const host=$('wrongList');host.innerHTML=list.length?list.map(x=>`<div class="wrong-row"><div><div><span class="qid">${safe(x.id)}</span> · ${safe(x.pack.name)}</div><div class="wrong-meta"><span>首次选择：${safe(x.firstChoice||'—')}</span><span>最近选择：${safe(x.lastChoice||'—')}</span><span>尝试：${Number(x.attempts||1)}次</span><span class="repair-badge">待修复</span></div></div><a class="btn" href="${x.pack.path}?filter=wrong&q=${encodeURIComponent(x.id)}">回到这题 →</a></div>`).join(''):'<div class="empty">当前没有待修复错题。第一次答错但之后已答对的题，会保留在“已修复”统计里，但不会继续占用待修复列表。</div>'}
renderPacks();renderWrong();document.querySelectorAll('[data-rv-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-rv-filter]').forEach(x=>x.classList.toggle('active',x===b));renderPacks(b.dataset.rvFilter)}));const reset=$('rvReset');if(reset)reset.addEventListener('click',()=>{if(!confirm('清除全部现代专项训练记录？原132题统一训练器和Hidden Future不会被清除。'))return;localStorage.removeItem(STORE);location.reload()});
})();