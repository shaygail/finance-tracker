import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick tunnels / other public hosts in `next dev`
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "options-wins-acne-processors.trycloudflare.com",
  ],
};

export default nextConfig;
