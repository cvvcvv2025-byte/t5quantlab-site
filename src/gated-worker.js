import app from "./worker.js";

const PAID_BUILDER_ROUTES = new Set([
  "/api/builder/upload",
  "/api/builder/analyze",
  "/api/builder/modify"
]);

const BILLABLE_ACTION = new Map([
  ["/api/builder/analyze", "analyze"],
  ["/api/builder/modify", "modify"]
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

function nowIso() {
  return new Date().toISOString();
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function constantTimeSecretMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const [aHex, bHex] = await Promise.all([sha256Hex(expected), sha256Hex(supplied)]);
  let diff = 0;
  for (let i = 0; i < aHex.length; i += 1) diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  return diff === 0;
}

async function ensureAccessDb(env) {
  if (!env.BUILDER_DB) return;
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS builder_access_grants (
      grant_id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      label TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      analyze_remaining INTEGER NOT NULL DEFAULT 0,
      modify_remaining INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_builder_access_token_hash
      ON builder_access_grants(token_hash)`)
  ]);
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] || request.headers.get("X-Builder-Access-Token") || "").trim();
}

async function resolveAccess(request, env) {
  // Owner/admin bypass for testing only. It is disabled unless a separate
  // BUILDER_ACCESS_KEY Cloudflare Secret has explicitly been configured.
  const adminSupplied = request.headers.get("X-Builder-Access-Key") || "";
  if (await constantTimeSecretMatch(env.BUILDER_ACCESS_KEY || "", adminSupplied)) {
    return {
      kind: "admin",
      grant_id: "admin",
      plan: "admin",
      analyze_remaining: null,
      modify_remaining: null,
      expires_at: null
    };
  }

  const token = bearerToken(request);
  if (!token || !env.BUILDER_DB) return null;

  await ensureAccessDb(env);
  const tokenHash = await sha256Hex(token);
  const grant = await env.BUILDER_DB.prepare(`SELECT grant_id, plan, status, analyze_remaining, modify_remaining, expires_at
    FROM builder_access_grants WHERE token_hash = ?`).bind(tokenHash).first();

  if (!grant || grant.status !== "active") return null;
  if (grant.expires_at && Date.parse(grant.expires_at) <= Date.now()) return null;
  return { kind: "grant", ...grant };
}

function paidRequired() {
  return json({
    ok: false,
    error: "AI 源码处理属于付费功能。当前账号未获得有效订阅权限，因此不会调用 OpenAI API，也不会产生 Token 费用。",
    code: "PAID_ACCESS_REQUIRED"
  }, 402);
}

function quotaRequired(action) {
  const label = action === "modify" ? "AI修改" : "AI分析";
  return json({
    ok: false,
    error: `${label}额度已用完。系统已阻止本次请求，不会调用 OpenAI API，也不会产生新的 Token 费用。`,
    code: "PAID_QUOTA_EXHAUSTED",
    action
  }, 402);
}

async function reserveCredit(env, access, action) {
  if (access.kind === "admin") return true;
  const column = action === "modify" ? "modify_remaining" : "analyze_remaining";
  const result = await env.BUILDER_DB.prepare(`UPDATE builder_access_grants
    SET ${column} = ${column} - 1, updated_at = ?
    WHERE grant_id = ? AND status = 'active' AND ${column} > 0
      AND (expires_at IS NULL OR expires_at > ?)`)
    .bind(nowIso(), access.grant_id, nowIso()).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function restoreCredit(env, access, action) {
  if (access.kind === "admin") return;
  const column = action === "modify" ? "modify_remaining" : "analyze_remaining";
  await env.BUILDER_DB.prepare(`UPDATE builder_access_grants
    SET ${column} = ${column} + 1, updated_at = ? WHERE grant_id = ?`)
    .bind(nowIso(), access.grant_id).run();
}

async function rejectDuplicateBillableRequest(request, env, action) {
  if (!env.BUILDER_DB) return null;
  let body;
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }
  const projectId = String(body?.projectId || "");
  if (!projectId) return null;

  const project = await env.BUILDER_DB.prepare("SELECT status FROM projects WHERE project_id = ?").bind(projectId).first();
  if (!project) return null;

  if (action === "analyze" && ["analyzed", "modified", "needs_clarification"].includes(project.status)) {
    return json({
      ok: false,
      error: "该项目已完成 AI 分析。为防止重复扣费，系统不会再次调用 OpenAI。",
      code: "DUPLICATE_ANALYSIS_BLOCKED"
    }, 409);
  }

  if (action === "modify" && project.status === "modified") {
    return json({
      ok: false,
      error: "该版本已经生成修改结果。为防止重复扣费，系统不会再次调用 OpenAI。",
      code: "DUPLICATE_MODIFICATION_BLOCKED"
    }, 409);
  }

  return null;
}

function accessStatus(access) {
  if (!access) return json({ ok: true, paid: false, plan: null, analyze_remaining: 0, modify_remaining: 0 });
  return json({
    ok: true,
    paid: true,
    plan: access.plan,
    analyze_remaining: access.analyze_remaining,
    modify_remaining: access.modify_remaining,
    expires_at: access.expires_at
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/builder/access" && request.method === "GET") {
      const access = await resolveAccess(request, env);
      return accessStatus(access);
    }

    if (PAID_BUILDER_ROUTES.has(url.pathname)) {
      const access = await resolveAccess(request, env);
      if (!access) return paidRequired();

      const action = BILLABLE_ACTION.get(url.pathname);
      if (action) {
        const duplicate = await rejectDuplicateBillableRequest(request, env, action);
        if (duplicate) return duplicate;

        const reserved = await reserveCredit(env, access, action);
        if (!reserved) return quotaRequired(action);

        const response = await app.fetch(request, env, ctx);
        if (!response.ok) await restoreCredit(env, access, action);
        return response;
      }
    }

    return app.fetch(request, env, ctx);
  }
};
