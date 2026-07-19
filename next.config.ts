import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript is type-checked in CI/build; keep ESLint from blocking deploys.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
