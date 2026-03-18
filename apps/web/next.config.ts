import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure build uses this directory as root (avoids lockfile warning when deploying from apps/web)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
