import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Baseline hardening for every response. (A Content-Security-Policy is deliberately not set here: Next, Recharts and
// framer-motion inject inline code, so it needs to be designed and tested against the whole UI rather than added blind.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Turbopack keeps a ~1 GB on-disk cache under .next/dev between runs. When that cache goes stale (a dev server
    // killed mid-write, two servers started in this folder, big refactors) Turbopack panics while building a page
    // ("Failed to write app endpoint ... Next.js package not found"), the browser's hot-reload connection breaks and
    // the page reloads in an endless loop. Cold starts are a few seconds slower without it; the loop cannot happen.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
