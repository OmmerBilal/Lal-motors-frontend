// Proxies /api/v1/* on the frontend's own origin through to the backend.
//
// Why: the frontend (lal-motors-ui-final-frontend.vercel.app) and backend
// (lal-motors-backend.vercel.app) are different sites once deployed, since
// vercel.app is a public suffix. A browser will not attach a SameSite=Lax
// auth cookie set by the backend to a later cross-site fetch() call to that
// same backend, so the /auth/me check after login always came back
// unauthenticated and bounced the user back to /login. Routing every API
// call through this same-origin rewrite means the browser only ever talks
// to its own origin — the auth cookie is set (and read back) as first-party,
// SameSite=Lax keeps working, and nothing needs to move to localStorage or
// relax SameSite/Secure.
//
// BACKEND_ORIGIN is the backend host only (no /api/v1 suffix). Local dev
// should use http://127.0.0.1:8000 — not localhost. Node resolves localhost
// to ::1 first; uvicorn listens on 127.0.0.1 only, so a localhost rewrite
// fails inside Next.js with ECONNRESET and FastAPI never sees the request.
function resolveBackendOrigin() {
  const fromEnv = (process.env.BACKEND_ORIGIN || process.env.BACKEND_API_URL || "").trim();
  const fallback =
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000"
      : "https://lal-motors-backend.vercel.app";

  let origin = fromEnv || fallback;
  origin = origin.replace(/\/+$/, "");
  // Legacy BACKEND_API_URL included /api/v1; strip it so the rewrite does not
  // produce /api/v1/api/v1/*.
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

const nextConfig = {
  experimental: {
    // Next.js rewrite proxy defaults to 30s. Vision analysis, multi-channel
    // drafts, and image generation routinely take longer; the proxy then
    // returns a bare HTTP 500 ("Internal Server Error") while FastAPI is
    // still working. Text-only chat stays fast and is unaffected.
    proxyTimeout: 300_000,
  },
  async rewrites() {
    const origin = resolveBackendOrigin();
    // Next evaluates this config in more than one process (dev server +
    // workers). Logging here does not write or delete files.
    console.info(`[next.config] Proxy /api/v1/* → ${origin}/api/v1/*`);
    return {
      // fallback: App Router handlers such as /api/v1/ai/* match first.
      // Remaining /api/v1/* calls are proxied to FastAPI. afterFiles would
      // steal the AI routes and send them through the 30s http-proxy.
      fallback: [
        {
          source: "/api/v1/:path*",
          destination: `${origin}/api/v1/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
