(()=>{
'use strict';
const STORAGE_KEY='t5_practice_progress_v1';
const PACKS=[
 {url:'/market-lab/practice/',name:'基础混合题',topic:'Mixed',range:'Q001–024'},
 {url:'/market-lab/practice/context-structure/',name:'Context & Structure',topic:'Context / Structure',range:'Q025–036'},
 {url:'/market-lab/practice/liquidity-execution/',name:'Liquidity & Execution',topic:'Liquidity / Execution',range:'Q037–048'},
 {url:'/market-lab/practice/risk-audit/',name:'Risk & EA Audit',topic:'Risk / Audit',range:'Q049–060'},
 {url:'/market-lab/practice/targets-volatility/',name:'Targets & Volatility',topic:'Targets / Volatility',range:'Q061–072'},
 {url:'/market-lab/practice/range-compression/',name:'Range & Compression',topic:'Range / Compression',range:'Q073–084'},
 {url:'/market-lab/practice/code-migration/',name:'Code Migration & EA Engineering',topic:'EA Engineering',range:'Q085–096'}
];
const $=id=>document.getElementById(id);
const state={questions:[],filtered:[],index:0,pack:'all',mode:'all',progress:loadProgress(),loaded:false};
function loadProgress(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{return {};}}
function saveProgress(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.progress));}
function stripTags(html){const d=document.createElement('div');d.innerHTML=html;return d.textContent||'';}
function parseChoices(el){if(!el)return[];let raw=el.innerHTML.replace(/<br\s*\/?\s*>/gi,'\n').replace(/&nbsp;/gi,' ');raw=stripTags(raw).replace(/\u3000/g,' ').trim();const out=[];const re=/(?:^|\s)([A-D])[\.．、]\s*([\s\S]*?)(?=(?:\s+[A-D][\.．、]\s*)|$)/g;let m;while((m=re.exec(raw))){out.push({letter:m[1],text:m[2].trim()});}if(out.length<2){const parts=raw.split(/(?=[A-D][\.．、])/).map(s=>s.trim()).filter(Boolean);for(const p of parts){const mm=p.match(/^([A-D])[\.．、]\s*(.+)$/);if(mm)out.push({letter:mm[1],text:mm[2].trim()});}}
 return out;
}
function parseCorrect(q){const t=q.querySelector('.answer strong')?.textContent||'';const m=t.match(/(?:答案\s*[:：]\s*)?([A-D])(?=[。．\.、\s]|$)/i);return m?m[1].toUpperCase():null;}
function inferBaseTopic(label){const s=(label||'').toUpperCase();if(/AUDIT|EA|STATE|REPAINT|LOOKAHEAD|PARITY/.test(s))return'EA Engineering';if(/RISK|T1|T2|MFE|MAE|SL|RUNNER/.test(s))return'Risk / Audit';if(/LIQUID|SWEEP|RECLAIM|FVG|ORDER BLOCK|OB/.test(s))return'Liquidity / Execution';if(/SESSION|ATR|VOLAT|TARGET|FILL R|PLANNED R/.test(s))return'Targets / Volatility';if(/RANGE|COMPRESSION|AUCTION/.test(s))return'Range / Compression';if(/BOS|CHOCH|NECKLINE|CONTEXT|TIMEFRAME|LOWER HIGH|STRUCTURE/.test(s))return'Context / Structure';return'Mixed';}
async function loadPack(pack,packIndex){const r=await fetch(pack.url,{cache:'no-store'});if(!r.ok)throw new Error(pack.name+' 加载失败');const html=await r.text();const doc=new DOMParser().parseFromString(html,'text/html');return [...doc.querySelectorAll('.q')].map((q,i)=>{const label=q.querySelector('small')?.textContent.trim()||`${pack.name} ${i+1}`;const correct=parseCorrect(q);const choices=parseChoices(q.querySelector('.choices'));return{id:`p${packIndex}-q${i+1}`,packIndex,packName:pack.name,packUrl:pack.url,range:pack.range,topic:pack.topic==='Mixed'?inferBaseTopic(label):pack.topic,label,question:q.querySelector('h3')?.textContent.trim()||'',choices,correct,explanation:q.querySelector('.answer')?.innerHTML||'',sourceIndex:i+1};}).filter(q=>q.question&&q.correct&&q.choices.length>=2);}
function statsFor(list=state.questions){let attempted=0,correct=0;const wrong={};for(const q of list){const p=state.progress[q.id];if(!p)continue;attempted++;if(p.correct)correct++;else wrong[q.topic]=(wrong[q.topic]||0)+1;}return{attempted,correct,accuracy:attempted?Math.round(correct/attempted*100):0,wrong};}
function setLoading(msg){$('trainerStatus').textContent=msg;}
function renderStats(){const s=statsFor(state.questions);$('statAttempted').textContent=s.attempted;
 $('statCorrect').textContent=s.correct;$('statAccuracy').textContent=s.attempted?s.accuracy+'%':'—';$('statRemaining').textContent=Math.max(0,state.questions.length-s.attempted);
 const weak=Object.entries(s.wrong).sort((a,b)=>b[1]-a[1]).slice(0,3);$('weakAreas').innerHTML=weak.length?weak.map(([k,v])=>`<span class="trainer-chip">${escapeHtml(k)} · ${v}错</span>`).join(''):'<span class="trainer-muted">暂无错题记录。完成几题后这里会显示薄弱环节。</span>';
 const ps=statsFor(state.filtered);$('filterSummary').textContent=`当前筛选 ${state.filtered.length} 题 · 已答 ${ps.attempted} · 正确 ${ps.correct}`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function buildFilter(){const sel=$('packFilter');sel.innerHTML='<option value="all">全部96题</option>'+PACKS.map((p,i)=>`<option value="${i}">${p.range} · ${p.name}</option>`).join('');sel.value=state.pack;}
function applyFilter(resetIndex=true){let list=[...state.questions];if(state.pack!=='all')list=list.filter(q=>String(q.packIndex)===state.pack);if(state.mode==='wrong')list=list.filter(q=>state.progress[q.id]&&!state.progress[q.id].correct);if(state.mode==='unanswered')list=list.filter(q=>!state.progress[q.id]);state.filtered=list;if(resetIndex)state.index=0;if(state.index>=list.length)state.index=Math.max(0,list.length-1);renderStats();renderQuestion();}
function renderQuestion(){const box=$('questionBox');if(!state.filtered.length){box.innerHTML='<div class="trainer-empty"><h3>当前筛选没有题目</h3><p>如果你选择了“错题重练”，说明当前没有错题；可以切回全部题目或未答题。</p></div>';updateNav();return;}
 const q=state.filtered[state.index];const p=state.progress[q.id];$('questionMeta').textContent=`${q.range} · ${q.packName} · ${q.topic}`;$('questionCounter').textContent=`${state.index+1} / ${state.filtered.length}`;
 box.innerHTML=`<div class="trainer-label">${escapeHtml(q.label)}</div><h2>${escapeHtml(q.question)}</h2><div class="trainer-choices">${q.choices.map(c=>`<button class="trainer-choice${p&&p.selected===c.letter?' selected':''}${p?(c.letter===q.correct?' correct':(p.selected===c.letter&&!p.correct?' wrong':'')):''}" data-letter="${c.letter}" ${p?'disabled':''}><b>${c.letter}</b><span>${escapeHtml(c.text)}</span></button>`).join('')}</div><div id="answerFeedback" class="trainer-feedback${p?' show':''}">${p?feedbackHtml(q,p):''}</div>`;
 if(!p)box.querySelectorAll('.trainer-choice').forEach(btn=>btn.addEventListener('click',()=>answer(q,btn.dataset.letter)));
 updateNav();
}
function feedbackHtml(q,p){const verdict=p.correct?'<strong class="ok">回答正确。</strong>':'<strong class="bad">回答错误。</strong> 正确答案：<b>'+q.correct+'</b>。';return `${verdict}<div class="trainer-explanation">${q.explanation}</div><div class="trainer-source"><a href="${q.packUrl}">查看原专题题包与上下文</a></div>`;}
function answer(q,letter){if(state.progress[q.id])return;state.progress[q.id]={selected:letter,correct:letter===q.correct,topic:q.topic,pack:q.packName,answeredAt:new Date().toISOString()};saveProgress();renderStats();renderQuestion();}
function updateNav(){$('prevQuestion').disabled=state.index<=0;$('nextQuestion').disabled=!state.filtered.length||state.index>=state.filtered.length-1;}
function nextUnanswered(){if(!state.filtered.length)return;let idx=state.filtered.findIndex((q,i)=>i>state.index&&!state.progress[q.id]);if(idx<0)idx=state.filtered.findIndex(q=>!state.progress[q.id]);if(idx>=0){state.index=idx;renderQuestion();}}
function resetProgress(){if(!confirm('只清除这个浏览器里的T5训练记录。确定重置吗？'))return;state.progress={};saveProgress();applyFilter();}
async function init(){try{setLoading('正在读取7个公开题包…');const groups=await Promise.all(PACKS.map(loadPack));state.questions=groups.flat();state.loaded=true;setLoading(`已载入 ${state.questions.length} 题。答题记录只保存在当前浏览器。`);buildFilter();applyFilter();
 $('packFilter').addEventListener('change',e=>{state.pack=e.target.value;applyFilter();});$('modeFilter').addEventListener('change',e=>{state.mode=e.target.value;applyFilter();});$('prevQuestion').addEventListener('click',()=>{if(state.index>0){state.index--;renderQuestion();}});$('nextQuestion').addEventListener('click',()=>{if(state.index<state.filtered.length-1){state.index++;renderQuestion();}});$('nextUnanswered').addEventListener('click',nextUnanswered);$('resetProgress').addEventListener('click',resetProgress);
 }catch(e){setLoading('训练器加载失败：'+e.message);$('questionBox').innerHTML='<div class="trainer-empty"><p>可以先使用原始题库页面继续训练。</p><a class="btn" href="/market-lab/practice/">打开原始题库</a></div>';}}
init();
})();