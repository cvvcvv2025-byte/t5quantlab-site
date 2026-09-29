import fs from 'node:fs';
// Production gate: this contract is part of the normal Syntax Check and must stay green before deploy.
const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const need=(c,m)=>{if(!c)errors.push(m)};
const gated=read('src/gated-worker.js');
const account=read('src/account-worker.js');
const checkout=read('checkout/index.html');

const start=gated.indexOf('async function handleCreateOrder(request, env) {');
const end=gated.indexOf('\nasync function getAuthorizedOrder', start);
const createOrder=start>=0&&end>start?gated.slice(start,end):'';
need(Boolean(createOrder),'gated handleCreateOrder must exist');
need(!createOrder.includes('Set-Cookie'),'pending order creation must not issue any Set-Cookie header');
need(createOrder.includes("status: \"pending\"")||createOrder.includes("status: 'pending'"),'pending order response must remain pending');

need(account.includes('async function forwardOwnedOrderAction(request, env, ctx) {'),'account ownership forwarder missing');
need(account.includes('ORDER_ACCOUNT_MISMATCH'),'account mismatch must be rejected explicitly');
need(account.includes('WHERE order_id = ? AND user_id IS NULL'),'legacy claim must be atomic and only for unowned orders');
for(const route of ['/api/orders/status','/api/orders/cancel','/api/orders/refund-eligibility','/api/payment/paypal/create','/api/payment/paypal/capture']){
  need(account.includes(`p === "${route}"`),`account worker must intercept ${route}`);
}
need(!account.includes('p === "/api/payment/paypal/webhook" && request.method'), 'PayPal webhook must not be forced through browser account ownership');
need(account.includes('normalizeEmail(order.customer_email) === user.email'),'legacy order claim must require verified account email match');
need(checkout.includes('未付款不会获得AI权限')&&checkout.includes('不会因为创建订单而写入Builder访问cookie'),'checkout must disclose no pre-payment Builder access');

if(errors.length){console.error('Production payment contract failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Production payment contract OK: pending orders issue no Builder cookie and browser order/payment actions are account-bound.');
