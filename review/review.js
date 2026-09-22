(function(){
  const file=document.getElementById('reviewFile');
  const zone=document.getElementById('uploadZone');
  const preview=document.getElementById('uploadPreview');
  const placeholder=document.getElementById('uploadPlaceholder');
  const name=document.getElementById('fileName');
  const status=document.getElementById('inputStatus');
  const side=document.getElementById('sideInput');
  const entry=document.getElementById('entryInput');
  const tradeTime=document.getElementById('timeInput');
  const sltp=document.getElementById('sltpInput');
  const submit=document.getElementById('reviewSubmit');
  const loading=document.getElementById('reviewLoading');
  let objectUrl=null;
  let selectedFile=null;
  let busy=false;

  function setStatus(text,isError=false){
    if(!status)return;
    status.textContent=text;
    status.style.color=isError?'#ffd166':'#7891ac';
  }

  function missingFields(){
    const missing=[];
    if(!selectedFile)missing.push('截图');
    if(!side?.value)missing.push('方向');
    if(!entry?.value)missing.push('Entry');
    if(!tradeTime?.value)missing.push('入场时间');
    return missing;
  }

  function refreshFormState(showMessage=false){
    const missing=missingFields();
    if(!submit)return missing.length===0;
    if(busy){
      submit.disabled=true;
      submit.textContent='正在生成复盘…';
      return false;
    }
    // Once a screenshot is loaded, keep the button clickable so the page can explain
    // exactly what is missing instead of looking broken/inert.
    submit.disabled=!selectedFile;
    if(!selectedFile){
      submit.textContent='先上传交易截图';
    }else if(missing.length){
      submit.textContent=`继续填写：还差 ${missing.length} 项`;
      if(showMessage)setStatus(`还差必填信息：${missing.join('、')}。填完后即可生成复盘。`,true);
    }else{
      submit.textContent='生成交易复盘';
      if(showMessage)setStatus('必填信息已完整，可以生成交易复盘。');
    }
    return missing.length===0;
  }

  function load(f){
    if(!f){setStatus('没有检测到图片，请重新选择。',true);return}
    if(!f.type||!f.type.startsWith('image/')){setStatus('目前只支持 PNG / JPG 等图片文件。',true);return}
    if(f.size>10*1024*1024){setStatus('图片超过 10MB，请先压缩后再上传。',true);return}
    selectedFile=f;
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(f);
    preview.src=objectUrl;
    preview.hidden=false;
    placeholder.hidden=true;
    name.textContent=f.name||'已粘贴截图';
    zone.classList.add('has-file');
    setStatus('截图已载入。还需要填写方向、Entry 与入场时间。');
    refreshFormState(false);
  }

  zone?.addEventListener('click',()=>file?.click());
  file?.addEventListener('change',()=>load(file.files?.[0]));

  ['dragenter','dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.add('dragging')}));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('dragging')}));
  zone?.addEventListener('drop',e=>load(e.dataTransfer?.files?.[0]));

  document.addEventListener('paste',e=>{
    const items=[...(e.clipboardData?.items||[])];
    const imageItem=items.find(x=>x.type?.startsWith('image/'));
    if(imageItem){e.preventDefault();load(imageItem.getAsFile())}
  });

  [side,entry,tradeTime,sltp].forEach(el=>el?.addEventListener('input',()=>refreshFormState(false)));
  side?.addEventListener('change',()=>refreshFormState(false));

  function stateClass(value){
    if(value==='通过')return'pass';
    if(value==='可接受')return'warn';
    if(value==='未通过')return'fail';
    return'unknown';
  }

  function addList(id,items){
    const box=document.getElementById(id);if(!box)return;box.innerHTML='';
    (items||[]).forEach(text=>{const li=document.createElement('li');li.textContent=text;box.appendChild(li)});
    if(!box.children.length){const li=document.createElement('li');li.textContent='未提供';box.appendChild(li)}
  }

  function render(review){
    document.getElementById('reviewSummary').textContent=review.summary||'复盘结果';
    document.getElementById('reviewTag').textContent=review.main_error_tag||'UNCLASSIFIED';
    document.getElementById('reviewConfidence').textContent=`判断置信度：${review.confidence||'—'}`;
    document.getElementById('reviewScope').textContent='只基于本次上传截图与填写字段；看不到的信息不参与判断。';
    const dims=[['Context',review.context],['Location',review.location],['Reaction',review.reaction],['Entry Timing',review.entry],['Management',review.management]];
    const root=document.getElementById('reviewDimensions');root.innerHTML='';
    dims.forEach(([label,item])=>{
      const row=document.createElement('div');row.className='dimension';
      const title=document.createElement('b');title.textContent=label;
      const st=document.createElement('span');st.className=`state ${stateClass(item?.status)}`;st.textContent=item?.status||'信息不足';
      const p=document.createElement('p');p.textContent=item?.note||'没有足够信息判断。';
      row.append(title,st,p);root.appendChild(row);
    });
    addList('reviewEvidence',review.evidence);
    addList('reviewLimitations',review.limitations);
    document.getElementById('reviewRule').textContent=review.corrective_rule||'暂无可执行修正规则。';
    document.getElementById('reviewFocus').textContent=review.training_focus||'继续积累样本。';
    const link=document.getElementById('trainingLink');
    link.href=review.training_type==='liquidity'?'/training/liquidity/':'/training/';
    link.textContent=review.training_type==='liquidity'?'进入 Liquidity 训练 →':'进入训练中心 →';
    const section=document.getElementById('generatedReview');section.classList.add('show');
    setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }

  submit?.addEventListener('click',async()=>{
    if(!refreshFormState(true)){
      const firstMissing=!side?.value?side:(!entry?.value?entry:(!tradeTime?.value?tradeTime:null));
      firstMissing?.focus();
      return;
    }
    busy=true;refreshFormState(false);loading?.classList.add('show');
    setStatus('截图正在用于本次复盘分析，请不要关闭页面。');
    try{
      const form=new FormData();
      form.append('image',selectedFile,selectedFile.name||'trade.png');
      form.append('side',side.value);
      form.append('entry',entry.value);
      form.append('tradeTime',tradeTime.value);
      form.append('sltp',sltp?.value||'');
      const res=await fetch('/api/review',{method:'POST',body:form});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||data.detail||'复盘生成失败');
      if(!data.review)throw new Error('复盘返回为空');
      render(data.review);
      setStatus('复盘已生成。请重点检查“信息边界”和“如果重来一次”，不要只看错误标签。');
    }catch(err){
      console.error(err);
      setStatus(`复盘暂时无法生成：${err.message||err}`,true);
    }finally{
      busy=false;loading?.classList.remove('show');refreshFormState(false);
    }
  });

  const q=new URLSearchParams(location.search);
  if(q.get('from')==='liquidity-complete')document.getElementById('baselineBridge')?.classList.add('show');
  refreshFormState(false);
})();
