(() => {
  const key = document.getElementById('adminKey'), output = document.getElementById('adminResult');
  async function api(url, body) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'X-Builder-Access-Key': key.value, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || '检查失败'); return d;
  }
  document.getElementById('verifyFiles').onclick = async () => {
    try { output.textContent = '正在读取并校验安装包…'; output.textContent = JSON.stringify(await api('/api/admin/delivery-check'), null, 2); }
    catch (e) { output.textContent = e.message; }
  };
  document.getElementById('verifyProviders').onclick = async () => {
    try { output.textContent = '正在执行只读运行检查…'; output.textContent = JSON.stringify(await api('/api/admin/runtime-health?deep=1'), null, 2); }
    catch (e) { output.textContent = e.message; }
  };
  document.getElementById('loadTickets').onclick = async () => {
    const box = document.getElementById('ticketList'); box.replaceChildren();
    try {
      const d = await api('/api/admin/support');
      if (!d.tickets.length) box.textContent = '当前没有客户工单。';
      for (const ticket of d.tickets) {
        const card = document.createElement('article'); card.className = 'card';
        const heading = document.createElement('h3'); heading.textContent = ticket.ticket_id + ' · ' + ticket.status;
        const text = document.createElement('p'); text.style.whiteSpace = 'pre-wrap'; text.textContent = ticket.email + '\n订单：' + (ticket.order_id || '未提供') + '\n' + ticket.message;
        const reply = document.createElement('textarea'); reply.value = ticket.reply || ''; reply.rows = 4; reply.maxLength = 4000; reply.style.width = '100%'; reply.setAttribute('aria-label', '工单回复');
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = '保存站内回复';
        button.onclick = async () => { button.disabled = true; try { await api('/api/admin/support/reply', { ticket_id: ticket.ticket_id, reply: reply.value }); button.textContent = '回复已保存，客户可凭查询码查看'; } catch (e) { output.textContent = e.message; } finally { button.disabled = false; } };
        card.append(heading, text, reply, button); box.append(card);
      }
    } catch (e) { output.textContent = e.message; }
  };
})();
