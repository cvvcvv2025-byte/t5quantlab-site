export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "t5quantlab-builder",
        r2: Boolean(env.USER_CODE_BUCKET),
        d1: Boolean(env.BUILDER_DB),
        openai: Boolean(env.OPENAI_API_KEY),
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({
        ok: false,
        error: "API route not implemented yet",
      }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
