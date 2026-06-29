import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  async redirects() {
    return [
      {
        destination: "/admin",
        permanent: false,
        source: "/agent",
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
