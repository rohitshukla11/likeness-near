import type { NextConfig } from "next";

/** One app: pages and the API route handlers both live here (no separate backend). */
const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Images are served as committed (no runtime optimizer, so no image-processing dependency at runtime).
  images: { unoptimized: true },
};

export default nextConfig;
