import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@baby-atlas/api",
    "@baby-atlas/db",
    "@baby-atlas/schemas",
    "@baby-atlas/utils",
  ],
  typedRoutes: true,
};

export default withNextIntl(nextConfig);
