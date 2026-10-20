(() => {
  let poll = null;
  const status = document.getElementById('recoveryStatus');
  const select = document.getElementById('recentProjects');
  const headers = () => ({ 'X-Project-Token': project?.token || '' });
  async function restore() {
    if (!project?.id) return;
    const id = project.id;
    document.querySelector('[data-tab="sourcePane"]').click();
    const state = await apiJson('/api/builder/status?project_id=' + encodeURIComponent(id), { headers: headers() });
    if (project.id !== id) return;
    el('analysisBox').classList.add('hidden');
    el('modifyBox').classList.add('hidden');
    latestAnalysis = null;
    if (['analyzed', 'modified', 'needs_clarification'].includes(state.project.status)) {
      const r = await fetch('/api/builder/download?type=analysis&project_id=' + encodeURIComponent(id), { credentials: 'same-origin', headers: headers() });
      if (!r.ok) throw new Error('分析结果暂时无法读取，请稍后恢复项目重试。');
      const analysis = await r.json();
      if (project.id !== id) return;
      latestAnalysis = analysis;
      el('analysisText').textContent = formatAnalysis(latestAnalysis);
      el('analysisBox').classList.remove('hidden');
    }
    if (state.project.status === 'modified') {
      el('modifyText').textContent = '修改结果已保存：' + state.project.output_filename + '。可直接下载，无需再次生成。';
      el('modifyBox').classList.remove('hidden');
      el('confirmModify').disabled = true;
    } else el('confirmModify').disabled = false;
    const running = state.running === true;
    el('confirmModify').disabled = running || state.project.status === 'modified';
    el('retryAnalysis').classList.toggle('hidden', running || state.project.status !== 'uploaded');
    status.textContent = running ? '项目正在处理，完成后会自动恢复结果。请勿重复提交。' : '已恢复：' + state.project.filename;
    if (poll) clearTimeout(poll);
    if (running) poll = setTimeout(() => restore().catch(e => { status.textContent = errMessage(e); }), 5000);
  }
  document.getElementById('resumeProject').addEventListener('click', async () => {
    if (!select.value) return;
    project = { id: select.value, token: '' };
    try { await restore(); } catch (e) { status.textContent = errMessage(e); }
  });
  document.getElementById('retryAnalysis').addEventListener('click', async () => {
    const button = el('retryAnalysis'); button.disabled = true;
    try {
      const an = await apiJson('/api/builder/analyze', { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) });
      latestAnalysis = an.analysis;
      await restore(); await refreshAccess();
    } catch (e) { status.textContent = errMessage(e); await restore().catch(() => {}); }
    finally { button.disabled = false; }
  });
  window.addEventListener('t5:project-created', event => {
    select.add(new Option(event.detail.filename + ' · 已上传', event.detail.projectId));
    select.value = event.detail.projectId;
    status.textContent = '项目已记录，可在此恢复或从My T5继续。';
  });
  (async () => {
    try {
      let legacy = null; try { legacy = JSON.parse(sessionStorage.getItem('t5builderProject') || 'null'); } catch {}
      if (legacy?.id && legacy?.token && !legacy.userId) await apiJson('/api/account/builder-projects/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: legacy.id, project_token: legacy.token }) }).catch(() => {});
      const d = await apiJson('/api/account/builder-projects');
      select.replaceChildren(new Option('请选择项目', ''));
      for (const item of d.projects) select.add(new Option(item.filename + ' · ' + item.status, item.project_id));
      const requested = new URLSearchParams(location.search).get('project');
      if (requested && d.projects.some(x => x.project_id === requested)) { select.value = requested; project = { id: requested, token: '' }; await restore(); }
      else {
        const saved = JSON.parse(sessionStorage.getItem('t5builderProject') || 'null');
        if (saved?.id && d.projects.some(x => x.project_id === saved.id)) { project = saved; select.value = saved.id; await restore(); }
        else if (!d.projects.length) status.textContent = '还没有源码项目。完成首次上传后，项目会出现在这里。';
      }
    } catch (e) { select.replaceChildren(new Option('暂时无法读取项目', '')); status.textContent = '登录后可恢复账户项目；读取失败时请稍后重试。'; }
  })();
})();
