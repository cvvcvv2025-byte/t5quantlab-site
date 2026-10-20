(async () => {
  const box = document.getElementById('runtimeLicenses');
  if (!box) return;
  const names = { mtf_structure_panel_mt4: '多周期结构面板', neckline_mtf_mt4: '多周期颈线', progress_candle_mt4: '推进K线', attack_completion_c_mt5: 'Attack Completion C', trend_capture_mt5: 'Trend Capture', range_martingale_mt4: 'Range Martingale', range_aggressive_mt4_mt5: 'Range Aggressive' };
  const messages = { ACCOUNT_REQUIRED: '请先登录后查看授权。', ENTITLEMENT_REQUIRED: '当前会员权益不包含该产品，或已经到期。', ACTIVE_BINDING_EXISTS: '该产品已有激活账号，请先撤销原授权再更换。', INVALID_BINDING: '请检查平台、交易账号和服务器名称。', LICENSE_RELEASE_NOT_ENABLED: '该产品尚未开放新版激活，请继续使用当前下载版本。' };
  async function api(url, body) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (!r.ok) throw Error(messages[d.code] || '授权操作未完成，请稍后重试。');
    return d;
  }
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  async function render() {
    const data = await api('/api/account/runtime-licenses');
    box.replaceChildren();
    const enabled = data.products.filter(p => p.enabled);
    if (!enabled.length && !data.licenses.length) { box.textContent = '当前下载安装包无需在这里激活。会员到期后停止下载及更新；现有版本不会通过网站远程停用。'; return; }
    box.append(node('p', '新版授权按产品绑定一个交易账号与服务器。到期后 EA 停止新开仓及加仓，已有持仓继续管理。撤销在下一次联网校验后生效；断网宽限最长24小时，且不超过会员到期时间。重启后需要联网校验。'));
    for (const license of data.licenses) {
      const row = node('div'); row.className = 'account-row';
      row.append(node('p', (names[license.product_code] || license.product_code) + ' · ' + license.platform + ' · ' + license.account_login + ' · ' + license.broker_server + ' · ' + (license.status === 'active' ? '已绑定（运行仍需有效会员权益）' : '已撤销')));
      if (license.status === 'active') {
        const button = node('button', '撤销此账号授权'); button.className = 'btn'; button.type = 'button';
        const note = node('p');
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
    function platforms() { platform.replaceChildren(); for (const p of enabled.find(p => p.code === product.value).platforms) { const option = node('option', p); option.value = p; platform.append(option); } }
    product.addEventListener('change', platforms); platforms();
    const login = node('input'), server = node('input');
    login.required = server.required = true; login.type = 'text'; login.inputMode = 'numeric'; login.pattern = '[1-9][0-9]{0,19}'; login.maxLength = 20; server.maxLength = 120;
    login.placeholder = '交易账号（不是 T5 登录邮箱）'; server.placeholder = '交易服务器名称，需与终端完全一致';
    login.setAttribute('aria-label', '交易账号'); server.setAttribute('aria-label', '交易服务器');
    const button = node('button', '生成新版激活密钥'); button.className = 'btn primary'; button.type = 'submit';
    const output = node('div'); output.setAttribute('role', 'status');
    form.append(product, platform, login, server, button, output);
    form.addEventListener('submit', async e => {
      e.preventDefault(); button.disabled = true;
      try {
        const d = await api('/api/account/runtime-licenses', { product_code: product.value, platform: platform.value, account_login: login.value.trim(), broker_server: server.value.trim() });
        output.replaceChildren(node('p', '密钥仅显示这一次。请保存后填入新版 EA 的 InpT5LicenseKey 参数，不要分享。'));
        const key = node('input'); key.readOnly = true; key.value = d.license_key; key.setAttribute('aria-label', '新生成的授权密钥'); key.autocomplete = 'off'; key.spellcheck = false;
        output.append(key, node('p', '在 MT4/MT5 选项中允许 WebRequest 访问 https://t5quantlab.com。重新打开本页后可查看、撤销或更换已绑定账号。'));
      } catch (error) { output.textContent = error.message; button.disabled = false; }
    }); box.append(form);
  }
  try { await render(); } catch (error) { box.textContent = error.message; }
})();
