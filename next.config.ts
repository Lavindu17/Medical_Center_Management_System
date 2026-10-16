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
  // A second dev server (for example one pointed at a test database) must not share this folder's build output:
  // two servers writing to one .next directory is what corrupted the dev cache before. NEXT_DIST_DIR=.next-test npm run dev
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: {
    // Turbopack keeps a ~1 GB on-disk cache under .next/dev between runs. When that cache goes stale (a dev server
    // killed mid-write, two servers started in this folder, big refactors) Turbopack panics while building a page
    // ("Failed to write app endpoint ... Next.js package not found"), the browser's hot-reload connection breaks and
    // the page reloads in an endless loop. Cold starts are a few seconds slower without it; the loop cannot happen.
    turbopackFileSystemCacheForDev: false,
  },
  // My Work and Account are one page each for all staff now; the old per-role addresses still work
  async redirects() {
    const roles = "doctor|admin|hr|lab-assistant|pharmacist|receptionist";
    return [
      { source: `/:role(${roles})/work`, destination: "/staff/work", permanent: true },
      { source: `/:role(${roles})/account`, destination: "/staff/account", permanent: true },
      { source: `/:role(${roles})/settings`, destination: "/staff/account", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
