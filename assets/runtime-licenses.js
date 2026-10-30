(async () => {
  const box = document.getElementById('runtimeLicenses');
  if (!box) return;
  const names = { structure_decision_map_mt4: '结构决策面板', mtf_structure_panel_mt4: '多周期结构面板', neckline_mtf_mt4: '多周期颈线', progress_candle_mt4: '推进K线', attack_completion_c_mt5: 'Attack Completion C', trend_capture_mt5: 'Trend Capture', range_martingale_mt4: 'Range Martingale', range_aggressive_mt4_mt5: 'Range Aggressive' };
  const messages = { ACCOUNT_REQUIRED: '请先登录后查看授权。', ENTITLEMENT_REQUIRED: '当前会员权益不包含该产品，或已经到期。', ACTIVE_BINDING_EXISTS: '该产品已绑定其他账号。重装请使用原绑定账号；确需换绑时再撤销，撤销后有30分钟冷却期。', INSTALL_RETRY: '另一下载请求正在处理，请稍后再次点击。', ENTITLEMENT_OR_RELEASE_REQUIRED: '当前权益不包含该产品，或该安装包暂未开放。', INVALID_BINDING: '请检查平台、交易账号和服务器名称。', LICENSE_RELEASE_NOT_ENABLED: '该产品授权版升级中，已有权益保留，请等待新版交付。', NATIVE_COMPILER_UNAVAILABLE: '专属文件制作服务暂时离线，请稍后重试。已有文件仍按原授权规则使用。', NATIVE_BUILD_FAILED: '专属文件制作未完成，请稍后重新点击下载。', ENTITLEMENT_OR_BINDING_REVOKED: '权益已到期或账号授权已撤销，无法下载。' };
  for (const [code,name] of Object.entries({...names})) {names[code+'_v2'] = name+' · 终端授权新版';if(!['structure_decision_map_mt4','mtf_structure_panel_mt4','neckline_mtf_mt4','progress_candle_mt4'].includes(code))names[code+'_v3']=name+' · 签名授权版';}
  async function api(url, body) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (!r.ok) throw Error(d.code === 'REBIND_COOLDOWN' ? '原授权已撤销。可再次绑定的时间：' + new Date(d.retry_at).toLocaleString() : d.code === 'LICENSE_POLICY_REQUIRED' ? '请先确认该产品的新版授权规则。' : messages[d.code] || '授权操作未完成，请稍后重试。');
    return d;
  }
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  async function render() {
    const data = await api('/api/account/runtime-licenses');
    box.replaceChildren();
    const enabled = data.products.filter(p => p.enabled && !(p.protocol_version === 2 && data.products.some(v => v.enabled && v.protocol_version === 3 && v.code === p.code.replace(/_v2$/, '_v3'))));
    if (!enabled.length && !data.licenses.length) { box.textContent = '所有客户交付统一采用终端授权。尚未完成授权客户端验收的产品暂停客户下载，已有权益保留；已流出的旧文件无法事后加锁。'; return; }
    box.append(node('p', '授权绑定产品、平台、交易账号与服务器。到期后 EA 停止新开仓及加仓，已有持仓继续管理。具体联网宽限、终端与换绑规则以对应产品下方说明为准；旧安装包不因此自动获得防共享能力。'));
    let selectBinding = null;const licenseRows=new Map();
    const guide=node('a','查看图文安装说明');guide.href='/help/install/';box.append(guide);
    box.append(node('h3','绑定账号，下载专属安装包'),node('p','只显示当前权益可用的产品。无需保存或粘贴激活密钥；签名配置自动装入你的专属包。已绑定账号重装可再次下载，不用撤销。'));
    for (const license of data.licenses) {
      const row = node('div'); row.className = 'account-row';
      const spec = data.products.find(p => p.code === license.product_code);
      row.append(node('p', (names[license.product_code] || license.product_code) + ' · ' + license.platform + ' · ' + license.account_login + ' · ' + license.broker_server + ' · ' + (license.status === 'active' ? '已绑定（运行仍需有效会员权益）' : '已撤销')));
      if (license.status === 'active') {
        const button = node('button', '撤销此账号授权'); button.className = 'btn'; button.type = 'button';
        const note = node('p');
        if (spec?.protocol_version >= 2) row.append(node('p', '撤销后原配置和密钥不能恢复，30分钟后才可自助生成新绑定。原终端已取得的授权最多还可维持5分钟；期间不停止已有持仓管理。'));
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { await api('/api/account/runtime-licenses/revoke', { license_id: license.license_id }); await render(); }
          catch (e) { note.textContent = e.message; button.disabled = false; }
        }); row.append(button, note);
        if(enabled.some(p=>p.code===license.product_code)){const again=node('button','重新下载此账号专属包');again.type='button';again.className='btn';again.addEventListener('click',()=>selectBinding?.(license));row.append(again);}
      }
      box.append(row);licenseRows.set(license.product_code,row);
    }
    if (!enabled.length) return;
    const form = node('form'), product = node('select'), platform = node('select');
    product.setAttribute('aria-label', '授权产品'); platform.setAttribute('aria-label', '交易平台');
    for (const p of enabled) { const option = node('option', (p.kind==='ea'?'EA · ':'指标 · ')+(names[p.code] || p.code)); option.value = p.code; product.append(option); }
    const policy = node('p'), accept = node('input'), acceptLabel = node('label');
    accept.type = 'checkbox'; acceptLabel.append(accept,document.createTextNode('我已了解本产品授权范围、联网宽限及撤销换绑规则。'));
    function platforms() {
      platform.replaceChildren(); const spec = enabled.find(p => p.code === product.value);
      for (const p of spec.platforms) { const option = node('option', p); option.value = p; platform.append(option); }
      const v2 = spec.protocol_version >= 2;
      button.textContent = spec.protocol_version === 3 ? '激活并下载专属安装包' : '生成旧版激活密钥';
      policy.textContent = v2 ? '新版：同一授权同时允许一个MT终端安装实例，可在该终端多个图表使用。每分钟联网校验，断网宽限最多5分钟；迁移前退出原终端并等待原租期结束。撤销后30分钟才能自助重新绑定。终端标识不等于硬件锁，不能保证抵御环境克隆或程序篡改。' : '旧授权：按交易账号绑定，断网宽限最多24小时；尚无终端并发限制。';
      if(spec.code==='structure_decision_map_mt4'){policy.textContent+=' 本产品为单文件只读图表程序：放入 Experts 后加载，无需密钥、授权助手、模板或SET，不下单。';}
      else if(spec.protocol_version===3)policy.textContent+=' 首次从手动密钥升级会更换旧密钥：安装后请移除同产品旧授权助手，再加载新模板；EA原来填过密钥的请将密钥参数清空。已有专属包再次下载不会更换密钥。';
      accept.checked = false; accept.required = v2; acceptLabel.hidden = !v2;
    }
    product.addEventListener('change', platforms);
    const login = node('input'), server = node('input');
    login.required = server.required = true; login.type = 'text'; login.inputMode = 'numeric'; login.pattern = '[1-9][0-9]{0,19}'; login.maxLength = 20; server.maxLength = 120;
    login.placeholder = '交易账号（不是 T5 登录邮箱）'; server.placeholder = '交易服务器名称，需与终端完全一致';
    login.setAttribute('aria-label', '交易账号'); server.setAttribute('aria-label', '交易服务器');
    const button = node('button', '生成新版激活密钥'); button.className = 'btn primary'; button.type = 'submit';
    platforms();
    const output = node('div'); output.setAttribute('role', 'status');
    form.append(product, platform, policy, acceptLabel, login, server, button, output);
    form.addEventListener('submit', async e => {
      e.preventDefault(); button.disabled = true;
      try {
        const spec = enabled.find(p => p.code === product.value);
        const binding = { product_code: product.value, platform: platform.value, account_login: login.value.trim(), broker_server: server.value.trim(), ...(spec.protocol_version >= 2 && accept.checked ? {license_policy_version:spec.protocol_version === 3 ? 'signed-v3-20261028' : 'terminal-v2-20261023'} : {}) };
        if (spec.protocol_version === 3) {
          output.textContent='正在核对权益并制作你的专属安装包…';
          const response=await fetch('/api/account/runtime-licenses/install-package',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(binding)});
          if(!response.ok){const error=await response.json();throw Error(error.code==='REBIND_COOLDOWN'?'原授权已撤销，冷却期内无法重新绑定。可再次绑定时间：'+new Date(error.retry_at).toLocaleString():messages[error.code]||error.error||'专属包暂时无法下载，请稍后重试。');}
          if((response.headers?.get('Content-Type')||'').includes('application/json')){
            let job=await response.json();
            for(let attempt=0;job.status!=='ready'&&attempt<90;attempt++){
              if(['failed','cancelled'].includes(job.status))throw Error(messages[job.code]||'专属文件制作未完成，请重新点击下载。');
              output.textContent=job.status==='building'?'正在为你的账号原生编译专属文件，请稍候…':'专属文件排队制作中，请保留页面…';
              await new Promise(resolve=>setTimeout(resolve,3000));
              job=await api('/api/account/runtime-licenses/single-file-builds/'+job.job_id);
              if(job.compiler_online===false&&job.status!=='ready')output.textContent='制作服务暂时离线，任务已保留；稍后重新下载可继续。';
            }
            if(job.status!=='ready')throw Error('专属文件仍在制作，任务已保留。稍后重新点击下载即可继续，无需撤销授权。');
            const link=node('a','下载含说明的 ZIP');link.href=job.download_url;link.download='';link.className='btn';
            const file=node('a','下载 '+(job.platform==='MT4'?'EX4':'EX5')+' 单文件');file.href=job.file_url;file.download='';file.className='btn primary';
            output.replaceChildren(node('p','专属文件已生成。解压后将 EX4／EX5 放入终端数据目录的 Experts 文件夹，在新空白图表加载。无需授权助手、密钥、模板或SET；首次仍需允许 WebRequest 访问 https://t5quantlab.com。程序仅显示图表，无需开启算法交易或DLL。'),file,document.createTextNode(' '),link);
            file.click();button.disabled=false;return;
          }
          const url=URL.createObjectURL(await response.blob()),link=node('a','下载已准备好的专属安装包');link.href=url;link.download='T5_'+product.value+'_'+platform.value+'_Personal_Install.zip';
          output.replaceChildren(node('p','专属包已准备好，无需手动输入密钥。Windows 完整解压后运行 Install-Windows.cmd，按提示选终端数据文件夹；新开空白图表加载包内说明指定的 T5 模板，指标与授权服务一起加载。首次仍需允许网站联网；Mac/Wine 见包内说明。EA 安装不启用自动交易，请自行确认交易参数。'),link,node('p','再次下载同一绑定无需撤销。请保管专属包，不要转发。首次从旧手动密钥升级会替换旧密钥，但不会取消账号绑定或绕过换绑冷却。'));
          const oldRow=licenseRows.get(product.value);if(oldRow){oldRow.replaceChildren(node('p',(names[product.value]||product.value)+' · '+platform.value+' · '+login.value.trim()+' · '+server.value.trim()+' · 已绑定（重装无需撤销）'));}
          link.click();setTimeout(()=>URL.revokeObjectURL(url),300000);button.disabled=false;return;
        }
        const d = await api('/api/account/runtime-licenses', binding);
        output.replaceChildren(node('p', '密钥仅显示这一次，请妥善保存。指标填写到同包 T5 License Bridge 的 InpT5LicenseKey；EA 填写到产品自身同名参数，不要分享。'));
        const key = node('input'); key.readOnly = true; key.value = d.license_key; key.setAttribute('aria-label', '新生成的授权密钥'); key.autocomplete = 'off'; key.spellcheck = false;
        output.append(key, node('p', '在 MT4/MT5 选项中允许 WebRequest 访问 https://t5quantlab.com。重新打开本页后可查看、撤销或更换已绑定账号。'));
      } catch (error) { output.textContent = error.message; button.disabled = false; }
    }); box.append(form);
    selectBinding = license => {
      product.value=license.product_code;platforms();platform.value=license.platform;
      login.value=license.account_login;server.value=license.broker_server;accept.checked=false;
      output.textContent='已填入原绑定信息，请确认授权规则后下载；不要撤销原授权。';
      form.scrollIntoView?.({behavior:'smooth',block:'center'});
    };
    function choose(selection){
      if(!selection)return;
      const slug=selection.slug,indicatorCodes={'structure-decision-map':'structure_decision_map_mt4','mtf-structure-panel':'mtf_structure_panel_mt4','neckline-mtf':'neckline_mtf_mt4','progress-candle':'progress_candle_mt4'},eaCodes={'attack-completion-c':'attack_completion_c_mt5_v3','trend-capture':'trend_capture_mt5_v3','range-martingale':'range_martingale_mt4_v3','range-aggressive':'range_aggressive_mt4_mt5_v3'};
      const code=selection.isEa?eaCodes[slug]:indicatorCodes[slug.replace(/-mt5$/,'')];
      if(!enabled.some(p=>p.code===code)){output.textContent='当前会员权益不包含此产品，或此版本暂未开放。请选择下拉框中已有权益的产品。';return;}
      product.value=code;platforms();if(!selection.isEa)platform.value=slug.endsWith('-mt5')?'MT5':'MT4';
      const prior=data.licenses.find(l=>l.product_code===code&&l.status==='active');
      if(prior){selectBinding(prior);}else{login.value='';server.value='';accept.checked=false;output.textContent='产品与平台已选好，请填写你实际使用的交易账号和完整券商服务器。';}
      form.scrollIntoView?.({behavior:'smooth',block:'center'});
    }
    window.addEventListener('t5-install-select',e=>choose(e.detail));
    const requested = typeof location!=='undefined' ? new URLSearchParams(location.search).get('install') : null;
    choose(window.t5InstallSelection || (requested ? {slug:requested,isEa:['attack-completion-c','trend-capture','range-martingale','range-aggressive'].includes(requested)} : null));

  }
  try { await render(); } catch (error) { box.textContent = error.message; }
})();
