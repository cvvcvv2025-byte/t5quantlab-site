(() => {
  const $=id=>document.getElementById(id), status=$('qaStatus');
  const names={structure_decision_map_mt4:'Structure Decision Map',mtf_structure_panel_mt4:'MTF Structure Panel',neckline_mtf_mt4:'Neckline MTF',progress_candle_mt4:'Progress Candle',range_martingale_mt4:'Range Martingale',range_aggressive_mt4_mt5:'Range Aggressive',attack_completion_c_mt5:'Attack Completion C',trend_capture_mt5:'Trend Capture'};
  for(const [code,name] of Object.entries({...names})){names[code+'_v2']=name+' v2';names[code+'_v3']=name+' v3';}
  const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  async function api(path,body){
    const r=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{'X-Builder-Access-Key':$('qaAdminKey').value,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const d=await r.json();if(!r.ok)throw Error(r.status===403?'管理密钥无效或请求未获授权。':d.code||'操作失败');return d;
  }
  async function load(){
    const d=await api('/api/admin/runtime-license-qa'),box=$('qaRecords');box.replaceChildren();
    status.textContent='正式开放的授权产品：'+(d.production_products_enabled.length?d.production_products_enabled.join('、'):'无；正式激活保持关闭');
    if(!d.tests.length)box.textContent='尚无测试记录。';
    for(const test of d.tests){
      const card=node('article');card.className='account-card';
      card.append(node('h3',names[test.product_code]+' · '+test.platform),node('p',test.account_login+' · '+test.broker_server),node('p','状态：'+test.status+'；到期：'+test.expires_at),node('p','服务端成功校验：'+test.verified_count+'次；最近：'+(test.last_verified_at||'未收到')));
      const actions=node('div');actions.className='account-actions';
      for(const [label,action,minutes] of [['撤销测试授权','revoke',60],['续期60分钟','renew',60],['设为1分钟后到期','renew',1]]){
        const button=node('button',label);button.className='btn';button.type='button';
        button.onclick=async()=>{button.disabled=true;try{await api('/api/admin/runtime-license-qa/update',{qa_id:test.qa_id,action,minutes});await load();}catch(e){status.textContent=e.message;button.disabled=false;}};
        actions.append(button);
      }
      card.append(actions);box.append(card);
    }
  }
  $('qaLoad').onclick=()=>load().catch(e=>status.textContent=e.message);
  $('qaIssue').onclick=async()=>{
    const bindings=[];
    for(const platform of ['MT4','MT5']){
      const prefix=platform==='MT4'?'qaMt4':'qaMt5',login=$(prefix+'Login').value.trim(),server=$(prefix+'Server').value.trim();
      if(!login&&!server)continue;
      if(!/^[1-9][0-9]{0,19}$/.test(login)||!server){status.textContent='请填写完整的模拟账号编号与服务器名称。';return;}
      let products=platform==='MT4'?['range_martingale_mt4','range_aggressive_mt4_mt5']:['attack_completion_c_mt5','trend_capture_mt5','range_martingale_mt4','range_aggressive_mt4_mt5'];
      if($('qaProtocol').value==='signed3')products=['structure_decision_map_mt4','mtf_structure_panel_mt4','neckline_mtf_mt4','progress_candle_mt4',...products.map(p=>p+'_v3')];
      for(const product of products)bindings.push({product_code:product,platform,account_login:login,broker_server:server});
    }
    if(!bindings.length||!$('qaDemoConfirmed').checked){status.textContent='请先填写模拟账号，并确认账号类型。';return;}
    if($('qaKeys').childElementCount){status.textContent='本页已有一次性密钥，请先保存；如确需重新签发，先撤销旧授权并重新打开本页。';return;}
    const button=$('qaIssue');button.disabled=true;
    try{
      const d=await api('/api/admin/runtime-license-qa',{...($('qaProtocol').value==='signed3'?{protocol_version:3}:{}),bindings,minutes:Number($('qaMinutes').value),lease_seconds:Number($('qaLease').value),demo_confirmed:true});
      const save=node('button','保存本机私有测试配置');save.type='button';save.className='btn';save.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({scope:'demo-qa-only',tests:d.tests},null,2)],{type:'application/json'})),link=node('a');link.href=url;link.download='T5_Demo_QA_Private.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),300000);};$('qaKeys').append(save);
      for(const test of d.tests){
        const card=node('div');card.className='account-card';card.append(node('h3',names[test.product_code]+' · '+test.platform+' · '+test.account_login));
        const label=node('label','一次性测试密钥'),input=node('input');input.type='password';input.readOnly=true;input.autocomplete='off';input.value=test.license_key;input.style.width='100%';input.setAttribute('aria-label',names[test.product_code]+' '+test.platform+' 测试密钥');
        const toggle=node('button','显示 / 隐藏密钥');toggle.type='button';toggle.className='btn';toggle.onclick=()=>{input.type=input.type==='password'?'text':'password';};
        label.append(input);card.append(label,toggle,node('p','仅用于 '+test.broker_server+'；到期 '+test.expires_at));$('qaKeys').append(card);
      }
      await load();status.textContent='已签发'+d.tests.length+'条限定账号测试授权。请自行复制对应密钥，不要发送交易密码。正式激活未改变。';
    }catch(e){status.textContent=e.message;button.disabled=false;}
  };
})();
