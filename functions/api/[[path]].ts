interface PagesFunctionContext {
  request: Request;
  env: {
    API_ORIGIN?: string;
  };
}

export async function onRequest({
  request,
  env,
}: PagesFunctionContext): Promise<Response> {
  const apiOrigin = env.API_ORIGIN;
  if (!apiOrigin) {
    console.error(
      "API_ORIGIN is not configured for the Cloudflare Pages API proxy.",
    );
    return new Response("API service is not configured.", { status: 500 });
  }

  let upstream: URL;
  try {
    const origin = new URL(apiOrigin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new Error("API_ORIGIN must be an HTTP(S) origin without a path.");
    }

    const incoming = new URL(request.url);
    upstream = new URL(origin.origin);
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;
  } catch (error) {
    console.error(
      "API_ORIGIN is invalid for the Cloudflare Pages API proxy.",
      error,
    );
    return new Response("API service configuration is invalid.", { status: 500 });
  }

  const headers = new Headers(request.headers);
  const incoming = new URL(request.url);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));

  const requestInit: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    requestInit.body = request.body;
    requestInit.duplex = "half";
  }

  return fetch(new Request(upstream, requestInit));
}
