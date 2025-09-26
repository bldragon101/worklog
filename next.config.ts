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
  env: {},

  // Configure redirects if needed
  async redirects() {
    return [];
  },

  // Configure rewrites if needed
  async rewrites() {
    return [];
  },
};

export default nextConfig;
