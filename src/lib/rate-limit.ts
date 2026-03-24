import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
const rateLimitStore: RateLimitStore = {};

/**
 * Simple rate limiting middleware for Next.js API routes
 */
export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimit(request: NextRequest) {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const pathname = new URL(request.url).pathname;
    const key = `rate_limit:${pathname}:${ip}`;
    const now = Date.now();

    // Get or create rate limit entry
    const entry = rateLimitStore[key];

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
    } else {
      // Increment count
      entry.count++;

      if (entry.count > config.maxRequests) {
        // Rate limit exceeded
        return NextResponse.json(
          {
            error:
              config.message || "Too many requests, please try again later.",
            retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil(
                (entry.resetTime - now) / 1000,
              ).toString(),
              "X-RateLimit-Limit": config.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
            },
          },
        );
      }
    }

    // Add rate limit headers
    const remaining = Math.max(0, config.maxRequests - (entry?.count || 1));
    const headers = {
      "X-RateLimit-Limit": config.maxRequests.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": new Date(
        entry?.resetTime || now + config.windowMs,
      ).toISOString(),
    };

    return { headers };
  };
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API rate limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 150,
    message: "Too many requests, please try again later.",
  },

  // Stricter rate limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many authentication attempts, please try again later.",
  },

  // File upload rate limit
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: "Too many file uploads, please try again later.",
  },

  // Export rate limit
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    message: "Too many export requests, please try again later.",
  },
};

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 60 * 1000); // Clean up every minute
