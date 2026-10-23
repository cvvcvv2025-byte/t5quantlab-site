/* Account checks always use a fresh, same-origin HttpOnly-cookie request. */
(() => {
  function safeNext(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/account/';
    try {
      const target = new URL(value, location.origin);
      if (target.origin !== location.origin || /^\/account\/login(?:\/|$)/.test(target.pathname)) return '/account/';
      return target.pathname + target.search + target.hash;
    } catch { return '/account/'; }
  }

  async function readSession() {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('暂时无法核对登录状态，请稍后重试，无需重新获取验证码。');
    const data = await response.json();
    if (!data.ok) throw new Error('暂时无法核对登录状态，请稍后重试。');
    return data;
  }

  async function confirmSession(email) {
    const data = await readSession();
    if (!data.authenticated || (email && data.user?.email?.toLowerCase() !== email.trim().toLowerCase())) {
      const error = new Error('邮箱验证已通过，但当前浏览器未保留本次登录状态。请先点“重新检查登录状态”；若仍失败，请在系统浏览器中打开本页后登录，避免反复获取验证码。');
      error.code = 'SESSION_NOT_PERSISTED';
      throw error;
    }
    return data;
  }

  // A stale summary must not bounce an authenticated browser back to login.
  async function recover(returnTo, showError) {
    try {
      const data = await readSession();
      if (data.authenticated) {
        showError('登录仍然有效，但账户资料暂时无法读取。请刷新重试，无需再次邮箱登录。');
        return;
      }
      location.replace('/account/login/?next=' + encodeURIComponent(safeNext(returnTo)) + '&session=missing');
    } catch (error) { showError(error.message); }
  }

  window.T5AccountSession = Object.freeze({ safeNext, readSession, confirmSession, recover });
})();
