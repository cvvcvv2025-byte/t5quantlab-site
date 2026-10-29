(async () => {
  try {
    const r = await fetch('/api/products/delivery', { cache: 'no-store' });
    if (!r.ok) throw new Error('delivery unavailable');
    const d = await r.json();
    let owner = false;
    try { const me = await fetch('/api/account/summary', { credentials: 'same-origin', cache: 'no-store' }); if (me.ok) owner = (await me.json()).delivery_owner === true; } catch {}

    for (const node of document.querySelectorAll('[data-delivery-count]')) node.textContent = (owner ? d.artifacts.filter(a => a.ready).length : (d.downloadable_count ?? d.ready_count)) + ' 个可下载安装包';
    const centerCount = document.getElementById('deliveryCount');
    if (centerCount) centerCount.textContent = (owner ? d.artifacts.filter(a => a.ready).length : (d.downloadable_count ?? d.ready_count)) + ' 个可下载安装包';
    for (const a of d.artifacts) {
      const upgrading = a.blocked_reason === 'LICENSE_UPGRADE_PENDING' && !owner;
      const held = !owner && !upgrading && a.performance_qualified === false && a.download_allowed === false;
      const allowed = a.ready && (a.download_allowed === true || owner);
      for (const node of document.querySelectorAll('[data-artifact-state="' + a.slug + '"]')) node.textContent = upgrading ? '防共享授权版升级中 · 已有权益保留' : held ? '当前版本下载暂停 · 请查看产品说明' : allowed ? '安装包已就绪 · v' + a.version : '安装包暂不可下载，请稍后重试';
      const button = document.querySelector('[data-' + (a.kind === 'ea' ? 'ea-download' : 'download') + '="' + a.slug + '"]');
      if (button) {
        button.disabled = !allowed;
        const state = button.closest('article')?.querySelector('.member-state');
        if (state && (held || button.closest('article').querySelectorAll('[data-download],[data-ea-download]').length === 1)) { state.textContent = upgrading ? '防共享授权版升级中 · 已有权益保留' : held ? '当前版本下载暂停 · 请查看产品说明' : allowed ? '安装包已就绪' : '安装包暂不可下载'; state.classList.toggle('ready', allowed); }
      }
    }
  } catch {
    for (const state of document.querySelectorAll('[data-artifact-state]')) state.textContent = 'Installation status unavailable. Please refresh or check the member center.';
    const node = document.getElementById('deliveryCount');
    if (node) node.textContent = '暂时无法核对安装包，请刷新重试';
    for (const node of document.querySelectorAll('[data-delivery-count]')) node.textContent = '安装包状态以会员中心核验为准';
  }
})();
