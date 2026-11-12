import type { NextConfig } from "next";

/** One app: pages and the API route handlers both live here (no separate backend). */
const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
};

export default nextConfig;
