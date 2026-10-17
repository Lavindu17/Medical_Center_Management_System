import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy: nothing is loaded from another site (no external scripts, fonts, images or frames), forms can only
// post back to this site, and the page cannot be framed or have its <base> changed. Inline scripts and styles stay allowed
// because Next, Recharts and framer-motion inject them; a nonce-based policy would need every page rendered dynamically.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Baseline hardening for every response.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
