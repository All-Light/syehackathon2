import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in $HOME otherwise makes Turbopack infer the home
  // directory as the workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;
