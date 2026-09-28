(()=>{
'use strict';
const KEY='t5_practice_progress_v2';
const panel=document.querySelector('.trainer-panel');
if(!panel)return;
const box=document.createElement('div');
box.className='trainer-field';
box.innerHTML='<label>进度备份 / 迁移</label><div class="mini-actions"><button class="btn" id="exportProgress" type="button">导出进度JSON</button><button class="btn" id="importProgress" type="button">导入进度JSON</button><input id="importProgressFile" type="file" accept="application/json,.json" class="hidden"></div><div id="progressTransferStatus" class="trainer-muted" style="margin-top:8px">文件只在浏览器本地读取，不上传服务器。</div>';
const statusAnchor=document.getElementById('trainerStatus');
if(statusAnchor)statusAnchor.before(box);else panel.appendChild(box);
const exportBtn=document.getElementById('exportProgress');
const importBtn=document.getElementById('importProgress');
const fileInput=document.getElementById('importProgressFile');
const status=document.getElementById('progressTransferStatus');
function readProgress(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}}
function countEntries(p){return Object.keys(p).filter(k=>k!=='__meta').length;}
exportBtn.addEventListener('click',()=>{
 const progress=readProgress();
 const payload={format:'t5-practice-progress',version:2,exportedAt:new Date().toISOString(),questionBank:96,progress};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='T5_Practice_Progress_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 status.textContent='已导出 '+countEntries(progress)+' 道题的本地记录。';
});
importBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async()=>{
 const f=fileInput.files&&fileInput.files[0];if(!f)return;
 if(f.size>1024*1024){status.textContent='文件过大，不像T5训练进度文件。';fileInput.value='';return;}
 try{
  const raw=await f.text();const data=JSON.parse(raw);
  if(data?.format!=='t5-practice-progress'||Number(data?.version)!==2||!data.progress||typeof data.progress!=='object')throw new Error('文件格式不匹配');
  const entries=countEntries(data.progress);if(entries>96)throw new Error('记录数量超过96题');
  if(!confirm('将用导入文件替换当前浏览器里的训练记录。确定继续吗？')){fileInput.value='';return;}
  localStorage.setItem(KEY,JSON.stringify(data.progress));status.textContent='导入成功，正在刷新训练器…';location.reload();
 }catch(e){status.textContent='导入失败：'+(e&&e.message?e.message:String(e));}
 fileInput.value='';
});
function ensureStyle(){if(document.querySelector('link[href="/assets/practice-visuals.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/practice-visuals.css';document.head.appendChild(link);}
function ensureScript(src){if(document.querySelector(`script[src="${src}"]`))return;const script=document.createElement('script');script.src=src;script.defer=true;document.body.appendChild(script);}
function loadVisualLayer(){ensureStyle();ensureScript('/assets/practice-visuals.js');ensureScript('/assets/practice-visuals-advanced.js');}
loadVisualLayer();
})();