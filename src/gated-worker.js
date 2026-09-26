import app from "./worker.js";

const PAID_BUILDER_ROUTES = new Set([
  "/api/builder/upload",
  "/api/builder/analyze",
  "/api/builder/modify"
]);

function denied() {
  return Response.json({
    ok: false,
    error: "AI 源码处理属于付费功能。当前账号未获得使用权限，因此不会调用 OpenAI API，也不会产生 Token 费用。",
    code: "PAID_ACCESS_REQUIRED"
  }, {
    status: 402,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function sha256(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hasPaidBuilderAccess(request, env) {
  // Closed by default. Merely configuring OPENAI_API_KEY never enables public AI usage.
  if (!env.BUILDER_ACCESS_KEY) return false;

  const supplied = request.headers.get("X-Builder-Access-Key") || "";
  if (!supplied) return false;

  const [expectedHash, suppliedHash] = await Promise.all([
    sha256(env.BUILDER_ACCESS_KEY),
    sha256(supplied)
  ]);
  return constantTimeEqual(expectedHash, suppliedHash);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (PAID_BUILDER_ROUTES.has(url.pathname)) {
      const allowed = await hasPaidBuilderAccess(request, env);
      if (!allowed) return denied();
    }

    return app.fetch(request, env, ctx);
  }
};
