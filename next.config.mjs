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
// relax SameSite/Secure. Locally this proxies to the local backend, so
// `next dev` needs no extra setup.
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination:
          "https://lal-motors-backend.vercel.app/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;