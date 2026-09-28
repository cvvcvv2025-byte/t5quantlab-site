(()=>{
'use strict';
const KEY='t5_builder_handoff_v1';
const MAX_AGE=2*60*60*1000;
const fileInput=document.getElementById('sourceFile');
const request=document.getElementById('changeRequest');
const platform=document.getElementById('sourcePlatform');
const sourcePane=document.getElementById('sourcePane');
if(!fileInput||!request||!platform||!sourcePane)return;
function clearHandoff(){sessionStorage.removeItem(KEY);document.getElementById('handoffBanner')?.remove();}
function read(){try{const p=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!p||p.version!==1)return null;if(Date.now()-Number(p.createdAt||0)>MAX_AGE){clearHandoff();return null;}if(typeof p.sourceText!=='string'||!p.name)return null;return p;}catch{return null;}}
function switchToSource(){const tab=[...document.querySelectorAll('.tabbtn')].find(x=>x.dataset.tab==='sourcePane');if(tab)tab.click();}
function banner(p){if(document.getElementById('handoffBanner'))return;const box=document.createElement('div');box.id='handoffBanner';box.className='statusline good';box.innerHTML='<span><b>已恢复免费体检交接：</b> '+escapeHtml(p.name)+'。源码仍只在当前浏览器，尚未上传。</span> <button class="btn" type="button" id="clearHandoff">清除本地交接</button>';sourcePane.insertBefore(box,sourcePane.children[1]||null);document.getElementById('clearHandoff')?.addEventListener('click',()=>{clearHandoff();fileInput.value='';document.getElementById('fileMeta').textContent='尚未选择文件';});}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function restore(){const p=read();if(!p)return;try{
 switchToSource();
 if(p.changeRequest&&!request.value.trim())request.value=p.changeRequest;
 if(['MT4','MT5','TradingView'].includes(p.platformGuess))platform.value=p.platformGuess;
 const f=new File([p.sourceText],p.name,{type:p.type||'text/plain',lastModified:Date.now()});
 const dt=new DataTransfer();dt.items.add(f);fileInput.files=dt.files;
 banner(p);
 fileInput.dispatchEvent(new Event('change',{bubbles:true}));
 const report=p.report||'';if(report){const pre=document.getElementById('spec');const title=document.getElementById('previewTitle');if(pre&&title&&pre.textContent==='尚未生成需求摘要。'){title.textContent='已恢复的免费体检摘要';pre.textContent=report;}}
 }catch(e){console.warn('T5 builder handoff restore failed',e);}
}
fileInput.addEventListener('change',e=>{if(e.isTrusted){const p=read();const f=fileInput.files&&fileInput.files[0];if(p&&f&&f.name!==p.name)clearHandoff();}});
restore();
})();