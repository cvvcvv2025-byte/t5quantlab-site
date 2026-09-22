(function(){
  const file=document.getElementById('reviewFile');
  const zone=document.getElementById('uploadZone');
  const preview=document.getElementById('uploadPreview');
  const placeholder=document.getElementById('uploadPlaceholder');
  const name=document.getElementById('fileName');
  const status=document.getElementById('inputStatus');
  let objectUrl=null;

  function setStatus(text,isError=false){
    if(!status)return;
    status.textContent=text;
    status.style.color=isError?'#ffd166':'#7891ac';
  }

  function load(f){
    if(!f){setStatus('没有检测到图片，请重新选择。',true);return}
    if(!f.type||!f.type.startsWith('image/')){setStatus('目前只支持 PNG / JPG 等图片文件。',true);return}
    if(f.size>15*1024*1024){setStatus('图片超过 15MB，请先压缩后再上传。',true);return}
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(f);
    preview.src=objectUrl;
    preview.hidden=false;
    placeholder.hidden=true;
    name.textContent=f.name||'已粘贴截图';
    setStatus('截图已载入。继续填写方向、Entry 与入场时间；当前预览不会上传到服务器。');
    zone.classList.add('has-file');
  }

  zone?.addEventListener('click',e=>{
    if(e.target===preview){file?.click();return}
    file?.click();
  });
  file?.addEventListener('change',()=>load(file.files?.[0]));

  // Prevent the browser from navigating away when a file is dropped anywhere on the page.
  ['dragenter','dragover','dragleave','drop'].forEach(ev=>{
    document.addEventListener(ev,e=>e.preventDefault());
  });

  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev,e=>{
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev,e=>{
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dragging');
  }));
  zone?.addEventListener('drop',e=>load(e.dataTransfer?.files?.[0]));

  // Mac users often copy screenshots directly to the clipboard, so support paste as well.
  document.addEventListener('paste',e=>{
    const items=[...(e.clipboardData?.items||[])];
    const imageItem=items.find(x=>x.type?.startsWith('image/'));
    if(imageItem){
      e.preventDefault();
      load(imageItem.getAsFile());
    }
  });

  const q=new URLSearchParams(location.search);
  if(q.get('from')==='liquidity-complete')document.getElementById('baselineBridge')?.classList.add('show');
})();
