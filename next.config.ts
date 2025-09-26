import type { NextConfig } from "next";

// Load environment configuration
const { loadEnvironment } = require("./env-config.js");
loadEnvironment();

const nextConfig: NextConfig = {
  // Allow cross-origin requests from your local network during development
  allowedDevOrigins: ["192.168.1.*"],

  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here
  },

  // Configure images if you're using Next.js Image component
  images: {
    domains: [], // Add domains for external images if needed
  },

  // Environment variables that should be available on the client
  env: {
    // Ensure APP_URL is available for security configurations
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "",
  },

  // Configure redirects if needed
  async redirects() {
    return [];
  },

  // Configure rewrites if needed
  async rewrites() {
    return [];
  },

  // Security headers are now handled by middleware for better CSP nonce support
  // See src/middleware.ts
};

export default nextConfig;
