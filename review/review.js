(function(){
  const file=document.getElementById('reviewFile');
  const zone=document.getElementById('uploadZone');
  const preview=document.getElementById('uploadPreview');
  const placeholder=document.getElementById('uploadPlaceholder');
  const name=document.getElementById('fileName');
  const status=document.getElementById('inputStatus');
  function load(f){
    if(!f||!f.type.startsWith('image/'))return;
    const url=URL.createObjectURL(f);
    preview.src=url;preview.hidden=false;placeholder.hidden=true;name.textContent=f.name;
    status.textContent='截图已载入。填写方向、Entry 与入场时间后，这些信息将和截图一起进入诊断。';
  }
  zone?.addEventListener('click',()=>file?.click());
  file?.addEventListener('change',()=>load(file.files?.[0]));
  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('dragging')}));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('dragging')}));
  zone?.addEventListener('drop',e=>load(e.dataTransfer?.files?.[0]));
  const q=new URLSearchParams(location.search);
  if(q.get('from')==='liquidity-complete')document.getElementById('baselineBridge')?.classList.add('show');
})();
