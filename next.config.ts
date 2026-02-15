import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export", // Disabled for API routes support
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;
