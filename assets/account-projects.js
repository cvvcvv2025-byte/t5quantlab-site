(async () => {
  const box = document.getElementById('builderProjects');
  try {
    const r = await fetch('/api/account/builder-projects', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('projects unavailable');
    const d = await r.json();
    box.replaceChildren();
    if (!d.projects?.length) { box.textContent = '还没有源码项目。'; return; }
    for (const p of d.projects) {
      const a = document.createElement('a'); a.className = 'account-row';
      a.href = '/tools/strategy-builder/?project=' + encodeURIComponent(p.project_id);
      a.textContent = p.filename + ' · ' + p.status + ' · 继续查看'; box.append(a);
    }
  } catch { box.textContent = '暂时无法读取项目，请重新登录或稍后重试。'; }
})();
