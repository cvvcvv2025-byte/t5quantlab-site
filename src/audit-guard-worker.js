import app from "./commercial-worker.js";

const AUDITED_BUILDER_ROUTES = new Set([
  "/api/builder/upload",
  "/api/builder/analyze",
  "/api/builder/modify",
  "/api/builder/download"
]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function auditSaltReady(env) {
  return String(env.AUDIT_HASH_SALT || "").trim().length >= 16;
}

function auditNotReady() {
  return json({
    ok: false,
    error: "付费源码服务的审计配置暂未就绪。本次请求已在上传、AI调用和额度扣减之前停止，请稍后重试。",
    code: "AUDIT_CONFIG_NOT_READY"
  }, 503);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (AUDITED_BUILDER_ROUTES.has(url.pathname) && !auditSaltReady(env)) {
      return auditNotReady();
    }
    return app.fetch(request, env, ctx);
  }
};
