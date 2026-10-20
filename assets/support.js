(() => {
  document.getElementById('copyWechat')?.addEventListener('click', async () => {
    const copyStatus = document.getElementById('contactCopyStatus');
    try {
      await navigator.clipboard.writeText('T5quantlab');
      copyStatus.textContent = '已复制微信号，请在微信中搜索添加。';
    } catch {
      copyStatus.textContent = '请长按或选中微信号 T5quantlab 手动复制。';
    }
  });
  const form = document.getElementById('supportForm'), status = document.getElementById('supportStatus');
  const receipt = document.getElementById('supportReceipt'), query = document.getElementById('queryToken');
  const show = text => { status.textContent = text; };
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try {
      const fields = new FormData(form);
      const r = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fields.get('email'), order_id: fields.get('order'), message: fields.get('message'), consent: fields.get('consent') === 'on' }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      query.value = d.query_token; receipt.textContent = '已记录工单 ' + d.ticket_id + '。请复制保存下方查询码；它用于在本页查看回复。';
      try { sessionStorage.setItem('t5_support_query', d.query_token); } catch {}
      show('提交成功。此入口不会自动发送确认邮件，请保留查询码。');
    } catch (e) { show(e.message || '提交失败，请稍后重试。'); } finally { button.disabled = false; }
  });
  document.getElementById('checkTicket').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/support/tickets', { headers: { 'X-Support-Token': query.value.trim() }, cache: 'no-store' });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      show(d.ticket.reply || '问题已记录，尚未回复。请保留查询码稍后查看。');
    } catch (e) { show(e.message || '查询失败，请稍后重试。'); }
  });
  try { query.value = sessionStorage.getItem('t5_support_query') || ''; } catch {}
})();
