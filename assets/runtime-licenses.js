(async () => {
  const box = document.getElementById('runtimeLicenses');
  if (!box) return;
  const names = { structure_decision_map_mt4: '结构决策面板', mtf_structure_panel_mt4: '多周期结构面板', neckline_mtf_mt4: '多周期颈线', progress_candle_mt4: '推进K线', attack_completion_c_mt5: 'Attack Completion C', trend_capture_mt5: 'Trend Capture', range_martingale_mt4: 'Range Martingale', range_aggressive_mt4_mt5: 'Range Aggressive' };
  const messages = { ACCOUNT_REQUIRED: '请先登录后查看授权。', ENTITLEMENT_REQUIRED: '当前会员权益不包含该产品，或已经到期。', ACTIVE_BINDING_EXISTS: '该产品已有激活账号，请先撤销原授权再更换。', INVALID_BINDING: '请检查平台、交易账号和服务器名称。', LICENSE_RELEASE_NOT_ENABLED: '该产品授权版升级中，已有权益保留，请等待新版交付。' };
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
    for (const license of data.licenses) {
      const row = node('div'); row.className = 'account-row';
      const spec = data.products.find(p => p.code === license.product_code);
      row.append(node('p', (names[license.product_code] || license.product_code) + ' · ' + license.platform + ' · ' + license.account_login + ' · ' + license.broker_server + ' · ' + (license.status === 'active' ? '已绑定（运行仍需有效会员权益）' : '已撤销')));
      if (license.status === 'active') {
        const button = node('button', '撤销此账号授权'); button.className = 'btn'; button.type = 'button';
        const note = node('p');
        if (spec?.protocol_version >= 2) row.append(node('p', '撤销后原密钥不能恢复，7天后才可自助生成新绑定。原终端已取得的授权最多还可维持5分钟；期间不停止已有持仓管理。'));
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { await api('/api/account/runtime-licenses/revoke', { license_id: license.license_id }); await render(); }
          catch (e) { note.textContent = e.message; button.disabled = false; }
        }); row.append(button, note);
      }
      box.append(row);
    }
    if (!enabled.length) return;
    const form = node('form'), product = node('select'), platform = node('select');
    product.setAttribute('aria-label', '授权产品'); platform.setAttribute('aria-label', '交易平台');
    for (const p of enabled) { const option = node('option', names[p.code] || p.code); option.value = p.code; product.append(option); }
    const policy = node('p'), accept = node('input'), acceptLabel = node('label');
    accept.type = 'checkbox'; acceptLabel.append(accept,document.createTextNode('我已了解本产品授权范围、联网宽限及撤销换绑规则。'));
    function platforms() {
      platform.replaceChildren(); const spec = enabled.find(p => p.code === product.value);
      for (const p of spec.platforms) { const option = node('option', p); option.value = p; platform.append(option); }
      const v2 = spec.protocol_version >= 2;
      button.textContent = data.owner_profile_supported && spec.protocol_version === 3 ? '下载本人账号绑定配置（免输入密钥）' : '生成新版激活密钥';
      policy.textContent = v2 ? '新版：同一授权同时允许一个MT终端安装实例，可在该终端多个图表使用。每分钟联网校验，断网宽限最多5分钟；迁移前退出原终端并等待原租期结束。撤销后7天才能自助重新绑定。终端标识不等于硬件锁，不能保证抵御环境克隆或程序篡改。' : '旧授权：按交易账号绑定，断网宽限最多24小时；尚无终端并发限制。';
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
        if (data.owner_profile_supported && spec.protocol_version === 3) {
          const response = await fetch('/api/account/runtime-licenses/owner-profile', {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(binding)});
          if (!response.ok) {const error = await response.json();throw Error(messages[error.code] || error.code || '绑定配置下载失败');}
          const url = URL.createObjectURL(await response.blob()), link = node('a', '保存本人账号绑定配置');
          link.href = url; link.download = 'T5Owner3_'+product.value+'_'+platform.value+'.credential';
          output.replaceChildren(node('p','将配置放入此终端数据目录的 MQL4/Files 或 MQL5/Files；签名授权版 EA 或指标辅助程序自动读取，仍须联网验证。复制到其他账号或终端不会绕过绑定。'),link);
          link.click(); setTimeout(()=>URL.revokeObjectURL(url),300000); return;
        }
        const d = await api('/api/account/runtime-licenses', binding);
        output.replaceChildren(node('p', '密钥仅显示这一次，请妥善保存。指标填写到同包 T5 License Bridge 的 InpT5LicenseKey；EA 填写到产品自身同名参数，不要分享。'));
        const key = node('input'); key.readOnly = true; key.value = d.license_key; key.setAttribute('aria-label', '新生成的授权密钥'); key.autocomplete = 'off'; key.spellcheck = false;
        output.append(key, node('p', '在 MT4/MT5 选项中允许 WebRequest 访问 https://t5quantlab.com。重新打开本页后可查看、撤销或更换已绑定账号。'));
      } catch (error) { output.textContent = error.message; button.disabled = false; }
    }); box.append(form);
  }
  try { await render(); } catch (error) { box.textContent = error.message; }
})();
