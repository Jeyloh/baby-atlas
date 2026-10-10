import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@baby-atlas/api",
    "@baby-atlas/db",
    "@baby-atlas/schemas",
    "@baby-atlas/utils",
  ],
  typedRoutes: true,
};

export default nextConfig;
