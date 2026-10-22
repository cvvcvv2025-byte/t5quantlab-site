(() => {
  'use strict';
  const $=id=>document.getElementById(id), KEY='t5_admin_key_session', STORE='t5_training_sandbox_order';
  const saved=()=>{try{return JSON.parse(sessionStorage.getItem(STORE)||'{}');}catch{return {};}};
  let latest=null;
  async function api(path,body,token,method) {
    const headers={'Content-Type':'application/json','X-Builder-Access-Key':sessionStorage.getItem(KEY)||''}; if(token)headers['X-Order-Token']=token;
    const r=await fetch(path,{method:method||(body?'POST':'GET'),credentials:'same-origin',cache:'no-store',headers,body:body?JSON.stringify(body):undefined});
    const d=await r.json(); if(!r.ok)throw Error(d.error||d.code||'操作失败'); return d;
  }
  async function setup(){const d=await api('/api/admin/training-sandbox/content');$('setup').textContent=d.ready?'私有课程已就绪。SHA256：'+(d.sha256||'未记录'):'尚无私有课程，请上传。';}
  async function refresh(){const t=saved();if(!t.order_id)throw Error('当前标签页没有测试订单');latest=await api('/api/admin/paypal-sandbox/status?order_id='+encodeURIComponent(t.order_id));$('result').textContent=JSON.stringify(latest,null,2);const types=new Set((latest.verified_webhooks||[]).map(e=>e.event_type));$('evidence').textContent=types.has('PAYMENT.CAPTURE.COMPLETED')&&types.has('PAYMENT.CAPTURE.REFUNDED')&&latest.result?.status==='refunded'&&latest.result?.grant_status==='revoked'?'沙箱回调与撤权证据齐全；仍需确认实际作答保存、退款后取题被拒绝。':'回调或最终撤权证据尚未齐全，请刷新；不要据此开启真实收费。';return latest;}
  const action=fn=>async()=>{try{await fn();}catch(e){$('status').textContent=e.message;}};
  $('saveKey').onclick=action(async()=>{const k=$('adminKey').value.trim();if(!k)throw Error('请输入管理员密钥');sessionStorage.setItem(KEY,k);$('adminKey').value='';await setup();});
  $('upload').onclick=action(async()=>{const f=$('contentFile').files[0];if(!f||f.size>300000)throw Error('请选择不超过300KB的课程JSON文件');const body=JSON.parse(await f.text());const d=await api('/api/admin/training-sandbox/content',body,null,'PUT');$('status').textContent='已上传私有课程：'+d.sha256;await setup();});
  $('start').onclick=action(async()=>{if(!$('terms').checked)throw Error('请先确认沙箱测试与本期条款');$('start').disabled=true;try{const d=await api('/api/admin/paypal-sandbox/order',{product_code:'training_breakout_v1',terms_accepted:true,terms_version:'training-v1-2026-10-22'});const t={order_id:d.order.order_id,order_token:d.order.order_token};sessionStorage.setItem(STORE,JSON.stringify(t));const payment=await api('/api/admin/paypal-sandbox/create',{order_id:t.order_id},t.order_token);t.paypal_order_id=payment.paypal_order_id;sessionStorage.setItem(STORE,JSON.stringify(t));const u=new URL(payment.approval_url);if(u.protocol!=='https:'||!['www.sandbox.paypal.com','sandbox.paypal.com'].includes(u.hostname))throw Error('不是PayPal沙箱地址，停止跳转');location.assign(u.href);}finally{$('start').disabled=false;}});
  $('refresh').onclick=action(refresh);
  $('refund').onclick=action(async()=>{const t=saved();if(!t.order_id)throw Error('缺少测试订单');await api('/api/admin/paypal-sandbox/refund',{order_id:t.order_id});$('status').textContent='已提交沙箱全额退款，等待核验回调和撤权。';await refresh();});
  $('export').onclick=()=>{if(!latest)return;const u=URL.createObjectURL(new Blob([JSON.stringify({kind:'t5-training-sandbox-evidence',checked_at:new Date().toISOString(),...latest},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='T5-training-sandbox-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  (async()=>{try{if(sessionStorage.getItem(KEY))await setup();const q=new URLSearchParams(location.search),t=saved();if(q.get('provider')==='paypal-sandbox'&&q.get('status')==='return'){if(!t.order_id||q.get('order_id')!==t.order_id||!q.get('token'))throw Error('回跳订单与本标签页记录不一致');$('status').textContent='买家已批准，正在核验沙箱Capture…';await api('/api/admin/paypal-sandbox/capture',{order_id:t.order_id,paypal_order_id:q.get('token')});await refresh();$('status').textContent='沙箱Capture完成，请验证训练供题与作答。';history.replaceState({},'',location.pathname);}else if(t.order_id)await refresh();}catch(e){$('status').textContent=e.message;}})();
})();
