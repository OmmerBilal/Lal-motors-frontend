import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROXY_TIMEOUT_MS = 300_000;

function backendOrigin(): string {
  const fromEnv = (process.env.BACKEND_ORIGIN || process.env.BACKEND_API_URL || "").trim();
  const fallback =
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000"
      : "https://lal-motors-backend.vercel.app";

  let origin = fromEnv || fallback;
  origin = origin.replace(/\/+$/, "");
  origin = origin.replace(/\/api\/v1$/i, "");

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.origin;
  } catch {
    return origin;
  }
}

async function proxyAi(req: NextRequest, path: string[]): Promise<Response> {
  const target = `${backendOrigin()}/api/v1/ai/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Buffer.from(await req.arrayBuffer());
  }

  console.info(`[ai-proxy] ${req.method} ${target}`);
  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();
  const out = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) out.set("content-type", upstreamType);
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) out.set("content-disposition", contentDisposition);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) out.set("cache-control", cacheControl);
  return new Response(body, { status: upstream.status, headers: out });
}

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  try {
    return await proxyAi(req, path || []);
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[ai-proxy] failed", timedOut ? "timeout" : error);
    return Response.json(
      {
        detail: timedOut
          ? "The AI request timed out before the backend finished. Please retry."
          : "The AI request could not reach the backend.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
