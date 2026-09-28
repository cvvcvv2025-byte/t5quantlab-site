(()=>{
'use strict';
const KEY='t5_builder_handoff_v1';
const MAX_AGE=2*60*60*1000;
const frame=document.getElementById('builderFrame');
const bar=document.getElementById('handoffBar');
const workspace=document.getElementById('workspace');
const empty=document.getElementById('empty');
const refresh=document.getElementById('refreshBuilder');
const clear=document.getElementById('clearHandoff');
function read(){try{const p=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!p||p.version!==1)return null;if(Date.now()-Number(p.createdAt||0)>MAX_AGE){sessionStorage.removeItem(KEY);return null;}if(!p.name||typeof p.sourceText!=='string')return null;return p;}catch{return null;}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setEmpty(){workspace.classList.add('hidden');empty.classList.remove('hidden');bar.classList.add('hidden');}
function inject(){const p=read();if(!p){setEmpty();return;}let doc,win;try{doc=frame.contentDocument;win=frame.contentWindow;if(!doc||!win)return;}catch{return;}
 const file=doc.getElementById('sourceFile');const req=doc.getElementById('changeRequest');const platform=doc.getElementById('sourcePlatform');if(!file||!req||!platform)return;
 try{
  const tab=[...doc.querySelectorAll('.tabbtn')].find(x=>x.dataset.tab==='sourcePane');tab?.click();
  if(p.changeRequest&&!req.value.trim())req.value=p.changeRequest;
  if(['MT4','MT5','TradingView'].includes(p.platformGuess))platform.value=p.platformGuess;
  const f=new win.File([p.sourceText],p.name,{type:p.type||'text/plain',lastModified:Date.now()});const dt=new win.DataTransfer();dt.items.add(f);file.files=dt.files;file.dispatchEvent(new win.Event('change',{bubbles:true}));
  const pane=doc.getElementById('sourcePane');if(pane&&!doc.getElementById('handoffInlineNotice')){const notice=doc.createElement('div');notice.id='handoffInlineNotice';notice.className='statusline good';notice.innerHTML='<b>已从免费体检恢复：</b> '+escapeHtml(p.name)+'。源码仍在浏览器中，只有你主动使用付费AI分析时才会上传。';pane.insertBefore(notice,pane.children[1]||null);}
  if(p.report){const spec=doc.getElementById('spec');const title=doc.getElementById('previewTitle');if(spec&&title&&spec.textContent==='尚未生成需求摘要。'){title.textContent='已恢复的免费体检摘要';spec.textContent=p.report;}}
  doc.addEventListener('click',e=>{const a=e.target.closest?.('a[href="/checkout/"]');if(!a)return;e.preventDefault();window.open('/checkout/','_blank','noopener');},true);
  bar.querySelector('b').textContent='本地交接已恢复：'+p.name;bar.querySelector('span').textContent='付款请在新标签完成；回来后点“付款后刷新权限”。';
 }catch(e){bar.querySelector('b').textContent='恢复失败';bar.querySelector('span').textContent=e&&e.message?e.message:String(e);}
}
frame.addEventListener('load',inject);
refresh.addEventListener('click',()=>{frame.src='/tools/strategy-builder/?embedded=1&refresh='+Date.now()+'#sourcePane';});
clear.addEventListener('click',()=>{sessionStorage.removeItem(KEY);setEmpty();});
if(!read())setEmpty();
})();