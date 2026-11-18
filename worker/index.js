const AUTH_PREFIX = "/api/neon-auth";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Neon Auth (sign-in, session, JWT), proxied so the cookie is first-party.
    if (url.pathname === AUTH_PREFIX || url.pathname.startsWith(AUTH_PREFIX + "/")) {
      const base = new URL(env.NEON_AUTH_BASE_URL);
      const rest = url.pathname.slice(AUTH_PREFIX.length);
      const target = new URL(
        base.pathname.replace(/\/$/, "") + rest + url.search,
        base.origin,
      );
      return fetch(new Request(target, request));
    }

    // Express API on Render.
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const upstreamRequest = new Request(target, request);
      const headers = new Headers(upstreamRequest.headers);
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
      return fetch(new Request(upstreamRequest, { headers }));
    }

    // Everything else: the built frontend.
    return env.ASSETS.fetch(request);
  },
};
