(() => {
'use strict';
const box=document.getElementById('paypalBox');if(!box)return;
const product=location.pathname==='/membership/automation-checkout/'?'premium_membership':location.pathname==='/membership/checkout/'?'indicator_membership':location.pathname==='/checkout/'?'code_workshop_single':null;if(!product)return;
fetch('/api/payments/catalog',{credentials:'same-origin'}).then(r=>r.json()).then(c=>{const item=c.products?.find(x=>x.code===product),price=item?.prices?.CNY;if(!c.ok||!c.providers?.alipay?.enabled||!Number.isInteger(price)||price<=0||item.delivery_ready===false)return;const link=document.createElement('a');link.className='btn';link.href='/checkout/alipay/?product='+encodeURIComponent(product);link.textContent='使用支付宝付款 · ¥'+(price/100).toFixed(2);box.after(link);}).catch(()=>{});
})();
