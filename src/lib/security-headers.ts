import { NextResponse } from "next/server";
import { generateNonce, getCSPHeader } from "./security-nonce";

/**
 * Add security headers to API responses
 */
export function addSecurityHeaders(
  response: NextResponse,
  nonce?: string,
): NextResponse {
  // Generate nonce if not provided
  const cspNonce = nonce || generateNonce();

  // Content Security Policy with nonce
  const isDevelopment = process.env.NODE_ENV !== "production";
  response.headers.set(
    "Content-Security-Policy",
    getCSPHeader(cspNonce, isDevelopment),
  );

  // X-Frame-Options (prevent clickjacking)
  response.headers.set("X-Frame-Options", "DENY");

  // X-Content-Type-Options (prevent MIME type sniffing)
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-XSS-Protection (enable XSS protection)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );

  // Strict-Transport-Security (HSTS) - only in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

/**
 * Create a secure response with security headers
 */
export function createSecureResponse(
  data: unknown,
  status: number = 200,
  additionalHeaders: Record<string, string> = {},
  nonce?: string,
): NextResponse {
  const response = NextResponse.json(data, { status });

  // Add security headers with nonce
  addSecurityHeaders(response, nonce);

  // Add additional headers
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * CORS configuration for API routes
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL || "*"
      : "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: Request): NextResponse | null {
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 200 });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  return null;
}
