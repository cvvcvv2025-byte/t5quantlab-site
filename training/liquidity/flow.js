(function(){
  const STORE='t5_liquidity_real20_v1';
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(_){return{}}}
  function doneCount(){const s=state();return (window.T5_CASES||[]).filter(c=>s[c.id]&&typeof s[c.id].score==='number').length}
  function isComplete(){const cases=window.T5_CASES||[];return cases.length>=20&&doneCount()>=20}
  const reportBtn=document.getElementById('reportBtn');
  if(reportBtn){
    const original=reportBtn.onclick;
    reportBtn.onclick=function(e){
      if(isComplete()){
        e?.preventDefault?.();
        location.href='/training/liquidity/result/';
        return false;
      }
      if(typeof original==='function') return original.call(this,e);
    };
  }
  function updateLabels(){
    if(!isComplete())return;
    if(reportBtn){reportBtn.disabled=false;reportBtn.textContent='查看完整20题诊断';}
    const footer=document.querySelector('.lab-footer a');
    if(footer){footer.textContent='了解真实交易复盘（Pro 功能预览） →';footer.href='/review/?from=liquidity-complete';}
  }
  const submit=document.getElementById('submitBtn');
  submit?.addEventListener('click',()=>setTimeout(updateLabels,500));
  updateLabels();
})();
