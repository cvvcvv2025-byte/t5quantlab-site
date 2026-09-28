(()=>{
'use strict';
const KEY='t5_builder_handoff_v1';
const MAX_BYTES=512*1024;
const fileInput=document.getElementById('sourceFile');
const request=document.getElementById('changeRequest');
const actions=document.querySelector('.inspect-side .mini-actions');
if(!fileInput||!request||!actions)return;
const btn=document.createElement('button');
btn.type='button';
btn.className='btn primary';
btn.textContent='带着体检结果进入 Builder';
btn.disabled=true;
actions.insertBefore(btn,actions.firstChild);
const note=document.createElement('div');
note.className='status';
note.style.marginTop='10px';
note.textContent='交接只保存在当前浏览器会话，源码不会因此上传。';
actions.after(note);
function currentFile(){return fileInput.files&&fileInput.files[0]?fileInput.files[0]:null;}
fileInput.addEventListener('change',()=>{const f=currentFile();btn.disabled=!f||f.size>MAX_BYTES;});
btn.addEventListener('click',async()=>{
 const f=currentFile();
 if(!f){note.textContent='请先选择源码文件。';return;}
 if(f.size>MAX_BYTES){note.textContent='文件超过512 KB，无法交接。';return;}
 btn.disabled=true;btn.textContent='正在准备本地交接…';
 try{
  const sourceText=await f.text();
  if(!sourceText.trim())throw new Error('源码文件为空');
  const payload={version:1,createdAt:Date.now(),name:f.name,type:f.type||'text/plain',size:f.size,sourceText,changeRequest:request.value||'',report:sessionStorage.getItem('t5_local_inspection_report')||'',platformGuess:(f.name.toLowerCase().endsWith('.mq4')?'MT4':f.name.toLowerCase().endsWith('.mq5')?'MT5':f.name.toLowerCase().endsWith('.pine')?'TradingView':'自动识别')};
  sessionStorage.setItem(KEY,JSON.stringify(payload));
  location.href='/tools/strategy-builder/continue/';
 }catch(e){note.textContent='本地交接失败：'+(e&&e.message?e.message:String(e));btn.disabled=false;btn.textContent='带着体检结果进入 Builder';}
});
})();