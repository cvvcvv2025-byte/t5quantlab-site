import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,src){fs.writeFileSync(path,src)}
function replaceOnce(src,from,to,label){
  if(src.includes(to)) return src;
  if(!src.includes(from)) throw new Error(`phase11 missing anchor: ${label}`);
  return src.replace(from,to);
}

// 1) Pending orders must never issue Builder access cookies at the core layer.
{
  const path='src/gated-worker.js';
  let s=read(path);
  s=replaceOnce(
    s,
    '  }, 200, { "Set-Cookie": builderCookie(builderAccessToken, product.expiresDays * 86400) });\n}',
    '  }, 200);\n}',
    'gated pending-order cookie'
  );
  write(path,s);
}

// 2) Sensitive browser order actions must be bound to the logged-in T5 account,
//    not only to a bearer-like order token. PayPal webhooks remain provider-authenticated.
{
  const path='src/account-worker.js';
  let s=read(path);
  const anchor='async function activeGrantForUser(env, userId) {';
  const helper=`async function forwardOwnedOrderAction(request, env, ctx) {\n  const user = await resolveSession(request, env);\n  if (!user) return json({ ok: false, error: "请先登录", code: "ACCOUNT_REQUIRED" }, 401);\n  await ensureAccountDb(env);\n  if (!(await ensureOrderUserColumn(env))) return json({ ok: false, error: "订单系统尚未初始化", code: "ORDER_SYSTEM_NOT_READY" }, 503);\n\n  let orderId = new URL(request.url).searchParams.get("order_id") || "";\n  if (!orderId && request.method !== "GET") {\n    try {\n      const body = await request.clone().json();\n      orderId = String(body?.order_id || "").trim();\n    } catch {}\n  }\n  if (!orderId) return json({ ok: false, error: "缺少订单号", code: "ORDER_ID_REQUIRED" }, 400);\n\n  let order = await env.BUILDER_DB.prepare("SELECT order_id, user_id, customer_email FROM orders WHERE order_id = ?").bind(orderId).first();\n  if (!order) return json({ ok: false, error: "订单不存在", code: "ORDER_NOT_FOUND" }, 404);\n\n  // Compatibility for legacy account-era orders created before user_id was populated:\n  // only the same verified T5 email may claim an unowned order, and only once.\n  if (!order.user_id && normalizeEmail(order.customer_email) === user.email) {\n    await env.BUILDER_DB.prepare("UPDATE orders SET user_id = ?, updated_at = ? WHERE order_id = ? AND user_id IS NULL")\n      .bind(user.user_id, nowIso(), orderId).run();\n    order = await env.BUILDER_DB.prepare("SELECT order_id, user_id, customer_email FROM orders WHERE order_id = ?").bind(orderId).first();\n  }\n\n  if (order.user_id !== user.user_id) {\n    return json({ ok: false, error: "该订单不属于当前 T5 账户", code: "ORDER_ACCOUNT_MISMATCH" }, 403);\n  }\n  return app.fetch(request, env, ctx);\n}\n\n`;
  if(!s.includes('async function forwardOwnedOrderAction(request, env, ctx) {')){
    if(!s.includes(anchor)) throw new Error('phase11 missing account helper anchor');
    s=s.replace(anchor,helper+anchor);
  }

  const routeAnchor='      if (p === "/api/orders/create" && request.method === "POST") return bindOrderToAccount(request, env, ctx);\n      if (p.startsWith("/api/builder/")) return bridgeBuilderAccess(request, env, ctx);';
  const routeReplacement='      if (p === "/api/orders/create" && request.method === "POST") return bindOrderToAccount(request, env, ctx);\n      if (p === "/api/orders/status" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);\n      if (p === "/api/orders/cancel" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);\n      if (p === "/api/orders/refund-eligibility" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);\n      if (p === "/api/payment/paypal/create" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);\n      if (p === "/api/payment/paypal/capture" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);\n      if (p.startsWith("/api/builder/")) return bridgeBuilderAccess(request, env, ctx);';
  s=replaceOnce(s,routeAnchor,routeReplacement,'account order action routes');
  write(path,s);
}

console.log('Production payment phase 11 applied: no pending Builder cookie; browser payment/order actions are account-bound.');
