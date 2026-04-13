import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WebSocket server runs separately on port 3001
  // API routes proxy to it when needed
};

export default nextConfig;
