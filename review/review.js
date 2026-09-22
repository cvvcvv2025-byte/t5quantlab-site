(function(){
  const file=document.getElementById('reviewFile');
  const zone=document.getElementById('uploadZone');
  const preview=document.getElementById('uploadPreview');
  const placeholder=document.getElementById('uploadPlaceholder');
  const name=document.getElementById('fileName');
  const status=document.getElementById('inputStatus');
  const entry=document.getElementById('entryInput');
  const sl=document.getElementById('slInput');
  const tp=document.getElementById('tpInput');
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

  function inferSide(){
    const e=Number(entry?.value),s=Number(sl?.value),t=Number(tp?.value);
    if(!Number.isFinite(e)||!Number.isFinite(s)||!Number.isFinite(t))return null;
    if(s<e&&t>e)return'Buy';
    if(s>e&&t<e)return'Sell';
    return'Invalid';
  }

  function missingFields(){
    const missing=[];
    if(!selectedFile)missing.push('截图');
    if(!entry?.value)missing.push('Entry');
    if(!sl?.value)missing.push('SL');
    if(!tp?.value)missing.push('TP');
    return missing;
  }

  function refreshFormState(showMessage=false){
    const missing=missingFields();
    const side=inferSide();
    if(!submit)return false;
    if(busy){submit.disabled=true;submit.textContent='正在生成复盘…';return false}
    submit.disabled=!selectedFile;
    if(!selectedFile){submit.textContent='先上传交易截图';return false}
    if(missing.length){
      submit.textContent=`继续填写：还差 ${missing.length} 项`;
      if(showMessage)setStatus(`还差：${missing.join('、')}。`,true);
      return false;
    }
    if(side==='Invalid'){
      submit.textContent='检查 Entry / SL / TP';
      setStatus('价格关系不成立：Buy 应为 SL < Entry < TP；Sell 应为 TP < Entry < SL。',true);
      return false;
    }
    submit.textContent=`生成${side}交易复盘`;
    if(showMessage)setStatus(`已识别为 ${side}。可以生成复盘。`);
    return true;
  }

  function load(f){
    if(!f){setStatus('没有检测到图片，请重新选择。',true);return}
    if(!f.type||!f.type.startsWith('image/')){setStatus('目前只支持 PNG / JPG 等图片文件。',true);return}
    if(f.size>10*1024*1024){setStatus('图片超过 10MB，请先压缩后再上传。',true);return}
    selectedFile=f;
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(f);
    preview.src=objectUrl;preview.hidden=false;placeholder.hidden=true;
    name.textContent=f.name||'已粘贴截图';zone.classList.add('has-file');
    setStatus('截图已载入。只需填写 Entry、SL、TP。');
    refreshFormState(false);
  }

  zone?.addEventListener('click',()=>file?.click());
  file?.addEventListener('change',()=>load(file.files?.[0]));
  ['dragenter','dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.add('dragging')}));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('dragging')}));
  zone?.addEventListener('drop',e=>load(e.dataTransfer?.files?.[0]));
  document.addEventListener('paste',e=>{const items=[...(e.clipboardData?.items||[])];const imageItem=items.find(x=>x.type?.startsWith('image/'));if(imageItem){e.preventDefault();load(imageItem.getAsFile())}});
  [entry,sl,tp].forEach(el=>el?.addEventListener('input',()=>refreshFormState(false)));

  function stateClass(value){if(value==='通过')return'pass';if(value==='可接受')return'warn';if(value==='未通过')return'fail';return'unknown'}
  function addList(id,items){const box=document.getElementById(id);if(!box)return;box.innerHTML='';(items||[]).forEach(text=>{const li=document.createElement('li');li.textContent=text;box.appendChild(li)});if(!box.children.length){const li=document.createElement('li');li.textContent='未提供';box.appendChild(li)}}
  function render(review){
    document.getElementById('reviewSummary').textContent=review.summary||'复盘结果';
    document.getElementById('reviewTag').textContent=review.main_error_tag||'UNCLASSIFIED';
    document.getElementById('reviewConfidence').textContent=`判断置信度：${review.confidence||'—'}`;
    document.getElementById('reviewScope').textContent='只基于本次上传截图与 Entry / SL / TP；看不到的信息不参与判断。';
    const dims=[['Context',review.context],['Location',review.location],['Reaction',review.reaction],['Entry Timing',review.entry],['Management',review.management]];
    const root=document.getElementById('reviewDimensions');root.innerHTML='';
    dims.forEach(([label,item])=>{const row=document.createElement('div');row.className='dimension';const title=document.createElement('b');title.textContent=label;const st=document.createElement('span');st.className=`state ${stateClass(item?.status)}`;st.textContent=item?.status||'信息不足';const p=document.createElement('p');p.textContent=item?.note||'没有足够信息判断。';row.append(title,st,p);root.appendChild(row)});
    addList('reviewEvidence',review.evidence);addList('reviewLimitations',review.limitations);
    document.getElementById('reviewRule').textContent=review.corrective_rule||'暂无可执行修正规则。';
    document.getElementById('reviewFocus').textContent=review.training_focus||'继续积累样本。';
    const link=document.getElementById('trainingLink');link.href=review.training_type==='liquidity'?'/training/liquidity/':'/training/';link.textContent=review.training_type==='liquidity'?'进入 Liquidity 训练 →':'进入训练中心 →';
    const section=document.getElementById('generatedReview');section.classList.add('show');setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }

  submit?.addEventListener('click',async()=>{
    if(!refreshFormState(true)){
      const firstMissing=!entry?.value?entry:(!sl?.value?sl:(!tp?.value?tp:null));firstMissing?.focus();return;
    }
    busy=true;refreshFormState(false);loading?.classList.add('show');
    setStatus('正在读取截图并生成复盘，正常应在几十秒内返回。');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    try{
      const form=new FormData();form.append('image',selectedFile,selectedFile.name||'trade.png');form.append('entry',entry.value);form.append('sl',sl.value);form.append('tp',tp.value);
      const res=await fetch('/api/review',{method:'POST',body:form,signal:controller.signal});const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||data.detail||'复盘生成失败');if(!data.review)throw new Error('复盘返回为空');
      render(data.review);setStatus(`复盘已生成，交易方向识别为 ${data.side||inferSide()}。`);
    }catch(err){
      console.error(err);
      if(err?.name==='AbortError')setStatus('复盘请求超过 45 秒，已自动停止，没有让页面一直空等。请稍后再试一次。',true);
      else setStatus(`复盘暂时无法生成：${err.message||err}`,true);
    }finally{
      clearTimeout(timeout);busy=false;loading?.classList.remove('show');refreshFormState(false);
    }
  });

  const q=new URLSearchParams(location.search);if(q.get('from')==='liquidity-complete')document.getElementById('baselineBridge')?.classList.add('show');refreshFormState(false);
})();