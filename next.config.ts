import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel optimization
  poweredByHeader: false,
  // Allow external images if needed
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
