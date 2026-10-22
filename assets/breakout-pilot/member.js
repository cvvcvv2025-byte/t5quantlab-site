(() => {
  'use strict';
  const sandbox = location.pathname.startsWith('/admin/training-sandbox/');
  const $ = id => document.getElementById(id), base = sandbox ? '/api/admin/training-sandbox/learning/' : '/api/training/breakout/';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const messages = { ACCOUNT_REQUIRED: '请先登录账户，再返回本页。', TRAINING_NOT_OPEN: '本期训练正在验收，尚未开放正式购买。', TRAINING_CONTENT_NOT_READY: '本期训练内容尚未就绪，请稍后再试。', TRAINING_ACCESS_REQUIRED: '当前账户没有有效的本期训练权限，或权限已经到期。', PREREQUISITE_REQUIRED: '请先完成前面的整组训练，再打开这一例。', CONTENT_VERSION_MISMATCH: '内容版本已更新，请刷新页面后重新作答。', SAME_ORIGIN_REQUIRED: '提交来源校验失败，请刷新本站页面后重试。' };
  let course, current, index = 0, report = {}, busy = false, futureOpen = false, requestId = null;
  async function api(path, body) {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { ...(body ? {'Content-Type':'application/json'} : {}), ...(sandbox ? {'X-Builder-Access-Key':sessionStorage.getItem('t5_admin_key_session') || ''} : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json(); if (!r.ok) throw Error(messages[data.code] || '暂时无法完成操作，请稍后重试。'); return data;
  }
  function draw(c, future = []) {
    const y = v => 220 - (v - 96) * 25, x = i => 30 + i * 34;
    const bars = c.bars.map((b, i) => { const color = b.c >= b.o ? '#8de0c4' : '#f1a391'; return `<g stroke="${color}"><line x1="${x(i)}" x2="${x(i)}" y1="${y(b.h)}" y2="${y(b.l)}"/><rect x="${x(i)-8}" y="${y(Math.max(b.o,b.c))}" width="16" height="${Math.max(2,Math.abs(b.c-b.o)*25)}" fill="${color}" fill-opacity="${b.closed ? 1 : .4}"/></g>`; }).join('');
    const trace = future.length ? `<polyline points="${[c.bars.at(-1).c,...future].map((v,i) => `${x(11+i)},${y(v)}`).join(' ')}" stroke="#f0ce85" fill="none" stroke-width="2"/>` : '';
    const svg = `<svg viewBox="0 0 590 260" role="img" aria-label="已知十二根K线，参考边界${esc(c.level)}${future.length ? '，包含提交后的后续示意' : ''}"><line x1="12" x2="575" y1="${y(c.level)}" y2="${y(c.level)}" stroke="#90a9c0" stroke-dasharray="4 4"/><text x="460" y="${y(c.level)-7}" fill="#b8c9d7">边界 ${esc(c.level)}</text>${bars}${trace}${c.bars.map((_,i) => `<text x="${x(i)-5}" y="247" fill="#a6bdcf" font-size="11">${i+1}</text>`).join('')}</svg><p class="chart-caption">归一化示意价格 · 固定96–104纵轴 · 形成中K线以浅色标记</p>`;
    $('chart').innerHTML = svg + '<details><summary>放大K线（可左右滑动）</summary><div class="zoom-chart">' + svg + '</div></details>';
  }
  function records() {
    $('records').innerHTML = Object.entries(report.records || {}).map(([id,r]) => { const score = v => v?.grade ? ['action','reason','condition'].map((k,i)=>['状态','依据','边界'][i]+(v.grade[k]?'✓':'×')).join(' / ') : '待整组完成'; return `<p>${esc(id)} · 首次 ${score(r.first)} · 最近 ${score(r.latest)} · ${r.attempts} 次作答</p>`; }).join('') || '<p>尚无本期作答记录。</p>';
    $('export').hidden = false;
  }
  async function open(i) {
    if (busy) return; busy = true;
    try {
      const data = await api('case/' + course.cases[i].id); index = i; current = data; futureOpen = false; requestId = null;
      const c = data.case, prior = report.records?.[c.id];
      $('position').textContent = `第${c.day}天 · ${c.group} · ${index+1}/16`;
      $('title').textContent = c.title; $('context').textContent = c.context; draw(c);
      const groups = [['action','1. 当前状态',[{id:'WAIT',text:'等待：证据仍不足'},{id:'CANCEL',text:'取消：当前候选或计划不合格'},{id:'READY',text:'条件满足：仅指符合本题规则'}]],['reason','2. 判断依据',c.reasonOptions],['condition','3. 失效或重建边界',c.conditionOptions]];
      $('options').innerHTML = groups.map(([key,title,opts]) => `<fieldset><legend>${title}</legend>${opts.map(o => `<label class="option"><input required type="radio" name="${key}" value="${esc(o.id)}" ${prior?.latest?.choices?.[key] === o.id ? 'checked' : ''}>${esc(o.text)}</label>`).join('')}</fieldset>`).join('');
      $('submit').textContent = prior ? '提交补做（首次记录保留）' : '提交判断';
      $('result').textContent = prior ? prior.feedback_pending ? '已保存首次判断。完成整组后开放反馈。' : '已保存，首次结果保留。可修改选择后补做。' : '';
      $('feedback').hidden = !data.feedback;
      if (data.feedback) {
        const names = {WAIT:'等待',CANCEL:'取消',READY:'条件满足'};
        const answer = data.feedback.answer;
        $('explanation').textContent = `参考状态：${names[answer.action]}。依据：${c.reasonOptions.find(o=>o.id===answer.reason)?.text || ''} 边界：${c.conditionOptions.find(o=>o.id===answer.condition)?.text || ''} ${data.feedback.explanation}`;
      } else $('explanation').textContent = '';
      $('futureText').hidden = true; $('future').textContent = '揭晓后续示意';
      $('prev').disabled = i === 0; $('next').disabled = i === course.cases.length-1;
      $('nav').innerHTML = course.cases.map((c,j) => `<button type="button" data-index="${j}" class="${j===i?'current':''}">${report.records?.[c.id] ? '✓ ' : ''}${esc(c.id)} · ${esc(c.title)}</button>`).join('');
      $('nav').querySelectorAll('button').forEach(b => b.onclick = () => open(Number(b.dataset.index)));
      $('status').textContent = '账户权限已核验。作答记录由服务器保存。';
    } catch(e) { $('status').textContent = e.message; } finally { busy = false; }
  }
  $('form').onsubmit = async e => {
    e.preventDefault(); if (busy) return; busy = true; $('submit').disabled = true;
    try {
      const choices = Object.fromEntries(new FormData(e.target));
      const fingerprint = JSON.stringify(choices); if (!requestId || requestId.fingerprint !== fingerprint) requestId = {id:crypto.randomUUID(),fingerprint};
      report = await api('submit', { case_id: current.case.id, choices, content_version: course.content_version, request_id: requestId.id }); records();
      busy = false; await open(index);
    } catch(e) { $('result').textContent = e.message; } finally { busy = false; $('submit').disabled = false; }
  };
  $('future').onclick = () => { if (!current?.feedback) return; futureOpen = !futureOpen; draw(current.case, futureOpen ? current.feedback.future : []); $('futureText').hidden = !futureOpen; $('futureText').textContent = current.feedback.futureExplanation; $('future').textContent = futureOpen ? '隐藏后续示意' : '揭晓后续示意'; };
  $('prev').onclick = () => open(index-1); $('next').onclick = () => open(index+1);
  $('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href=url; a.download='T5-breakout-records.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
  (async () => {
    try { report = await api('report'); records(); course = await api('course'); $('disclosure').textContent = course.disclosure; $('rules').innerHTML = course.policy.map(p=>`<li>${esc(p)}</li>`).join(''); $('app').hidden=false; await open(0); }
    catch(e) { $('status').textContent=e.message; const a=document.createElement('a'); a.href='/account/'; a.textContent='前往账户'; $('status').append(' ',a); }
  })();
})();
