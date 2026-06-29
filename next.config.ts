import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  poweredByHeader: false,
  async headers() {
    return [
      {
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
        source: "/(.*)",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/api/:path*",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/agent",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/admin",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/backtests",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/billing/:path*",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/dashboard",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/e/:path*",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/history",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/opportunities/:path*",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/portfolio",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/reset-password",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/settings",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/themes",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/unsubscribe",
      },
      {
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
        source: "/verify-email",
      },
    ];
  },
  async redirects() {
    return [
      {
        destination: "/admin",
        permanent: false,
        source: "/agent",
      },
      {
        destination: "/admin?tab=backtesting",
        permanent: false,
        source: "/backtests",
      },
      {
        destination: "/dashboard",
        permanent: false,
        source: "/themes",
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
