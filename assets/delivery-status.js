(async () => {
  try {
    const r = await fetch('/api/products/delivery', { cache: 'no-store' });
    if (!r.ok) throw new Error('delivery unavailable');
    const d = await r.json();
    for (const node of document.querySelectorAll('[data-delivery-count]')) node.textContent = (d.downloadable_count ?? d.ready_count) + ' 个可下载安装包';
    const centerCount = document.getElementById('deliveryCount');
    if (centerCount) centerCount.textContent = (d.downloadable_count ?? d.ready_count) + ' 个可下载安装包';
    for (const a of d.artifacts) {
      const held = a.performance_qualified === false && a.download_allowed === false;
      const allowed = a.ready && a.download_allowed !== false;
      for (const node of document.querySelectorAll('[data-artifact-state="' + a.slug + '"]')) node.textContent = held ? '绩效审计未通过 · 下载暂停' : allowed ? '安装包已就绪 · v' + a.version + (a.performance_qualified === false ? ' · 历史绩效审计未通过' : '') : '安装包暂不可下载，请稍后重试';
      const button = document.querySelector('[data-' + (a.kind === 'ea' ? 'ea-download' : 'download') + '="' + a.slug + '"]');
      if (button) {
        button.disabled = !allowed;
        const state = button.closest('article')?.querySelector('.member-state');
        if (state && (held || button.closest('article').querySelectorAll('[data-download],[data-ea-download]').length === 1)) { state.textContent = held ? '绩效审计未通过 · 下载暂停' : allowed ? '安装包已就绪' : '安装包暂不可下载'; state.classList.toggle('ready', allowed); }
      }
    }
  } catch {
    for (const state of document.querySelectorAll('[data-artifact-state]')) state.textContent = 'Installation status unavailable. Please refresh or check the member center.';
    const node = document.getElementById('deliveryCount');
    if (node) node.textContent = '暂时无法核对安装包，请刷新重试';
    for (const node of document.querySelectorAll('[data-delivery-count]')) node.textContent = '安装包状态以会员中心核验为准';
  }
})();
