(() => {
  'use strict';
  const messages = {
    WECHAT_BROWSER: '请点微信右上角“…”→“在浏览器打开”，使用 Safari 或 Chrome 登录同一个 T5 邮箱后继续。若已在 PayPal 确认或扣款，请勿重新付款，先刷新订单状态或联系客户支持。',
    PAYPAL_LINK_EXPIRED: '原 PayPal 付款链接已不可用。请先刷新订单状态；确认未付款后取消原订单再创建。若已扣款，请勿再次付款，联系客户支持。',
    PAYPAL_STATUS_UNAVAILABLE: '暂时无法核对 PayPal 订单，本次未创建新的付款。请稍后重试；若已扣款，请勿再次付款。',
    PAYPAL_APPROVAL_RECEIVED: 'PayPal 已收到此订单的付款确认。请返回原付款完成页继续确认，或刷新订单状态；请勿重复付款，状态未更新时联系客户支持。'
  };
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  window.T5PayPalCheckout = {
    message(error) { return messages[error?.code] || ''; },
    guard() {
      if (inWeChat) throw Object.assign(new Error(messages.WECHAT_BROWSER), { code: 'WECHAT_BROWSER' });
    },
    redirect(value) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !['www.paypal.com', 'paypal.com', 'www.sandbox.paypal.com', 'sandbox.paypal.com'].includes(url.hostname) || url.username || url.password || url.port) {
        throw new Error('付款地址未通过校验，请勿付款，联系客户支持。');
      }
      location.assign(url.href);
    }
  };
  const box = document.getElementById('paypalBox');
  if (!box) return;
  const note = document.createElement('div');
  note.className = 'status' + (inWeChat ? ' bad' : '');
  note.setAttribute('role', 'note');
  note.dataset.paypalBrowserHelp = '';
  note.textContent = inWeChat ? messages.WECHAT_BROWSER : '若 PayPal 显示“系统暂时无响应”：返回本页刷新订单状态。若已确认或扣款，请勿重复付款；仍无法打开时，请使用 Safari 或 Chrome，或联系客户支持并提供 T5 订单号。';
  if (inWeChat) {
    const page = document.createElement('a');
    page.href = location.origin + location.pathname;
    page.textContent = '\n本页地址（可长按复制）：' + page.href;
    note.appendChild(page);
  }
  box.after(note);
})();
