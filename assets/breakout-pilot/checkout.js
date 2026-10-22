(async () => {
  const status = document.getElementById('status'), form = document.getElementById('checkout');
  async function api(path, body, token) {
    const r = await fetch(path, { credentials:'same-origin', cache:'no-store', method:body?'POST':'GET', headers:{'Content-Type':'application/json',...(token?{'X-Order-Token':token}:{})}, body:body?JSON.stringify(body):undefined });
    const data = await r.json(); if (!r.ok) throw Error(data.error || '当前不能付款，请登录或联系支持核对。'); return data;
  }
  try {
    const catalog = await api('/api/training/breakout/catalog');
    if (!catalog.checkout_open) throw Error('训练购买尚未开放。');
    if (!catalog.sandbox_only) {
      document.title='购买突破确认训练｜T5';
      document.querySelector('h1').textContent='突破确认训练 · US$12';
      document.querySelector('.notice').textContent='一次性购买本期16个情境，30天访问权，不自动续费。付款后7个自然日内可申请全额退款，已练习也可申请。';
      document.getElementById('termsLabel').textContent='我已阅读并同意本期购买、交付与退款条款，了解付款后开通30天访问权，一次性支付US$12。';
      form.querySelector('button').textContent='前往PayPal支付US$12';
    }
    const params = new URLSearchParams(location.search), id = params.get('order_id');
    if (id && params.get('status') === 'return') {
      const token = sessionStorage.getItem('t5_training_order_' + id);
      if (!token || !params.get('token')) throw Error('此浏览器缺少订单凭证，请登录账户后联系支持核对。');
      status.textContent = '正在核验付款，请勿关闭页面…';
      await api('/api/payment/paypal/capture', {order_id:id,paypal_order_id:params.get('token')}, token);
      sessionStorage.removeItem('t5_training_order_' + id);
      status.textContent = '付款已核验，训练权限已开通。点击返回训练开始。';
      return;
    }
    status.textContent = params.get('status')==='cancel' ? '已返回，尚未确认付款。' : catalog.sandbox_only ? 'PayPal沙箱可用；请仅使用测试账户。' : '本期US$12，30天访问，不自动续费。'; form.hidden=false;
    form.onsubmit = async event => {
      event.preventDefault(); form.querySelector('button').disabled=true;
      try {
        const data = await api('/api/orders/create', {product_code:catalog.product_code,currency:catalog.currency,terms_accepted:true,terms_version:catalog.terms_version});
        const order = data.order; sessionStorage.setItem('t5_training_order_' + order.order_id, order.order_token);
        const payment = await api('/api/payment/paypal/create', {order_id:order.order_id}, order.order_token);
        const url = new URL(payment.approval_url);
        if (url.protocol!=='https:' || !(catalog.sandbox_only ? ['www.sandbox.paypal.com','sandbox.paypal.com'] : ['www.paypal.com','paypal.com']).includes(url.hostname)) throw Error('PayPal地址与当前支付环境不匹配，已停止跳转。');
        location.assign(url.href);
      } catch(e) { status.textContent=e.message; form.querySelector('button').disabled=false; }
    };
  } catch(e) { status.textContent=e.message; form.hidden=true; }
})();
