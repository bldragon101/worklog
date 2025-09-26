import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, getCSPHeader } from "./lib/security-nonce";

// Create the base Clerk middleware
const clerkHandler = clerkMiddleware();

export default async function middleware(request: NextRequest) {
  // First, run Clerk middleware
  const response =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await clerkHandler(request, {} as any)) || NextResponse.next();

  // Generate nonce for this request
  const nonce = generateNonce();
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Add security headers to all responses
  const headers = new Headers(response.headers);

  // Content Security Policy with nonce
  headers.set("Content-Security-Policy", getCSPHeader(nonce, isDevelopment));

  // X-Frame-Options (prevent clickjacking)
  headers.set("X-Frame-Options", "DENY");

  // X-Content-Type-Options (prevent MIME type sniffing)
  headers.set("X-Content-Type-Options", "nosniff");

  // X-XSS-Protection (enable XSS protection)
  headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );

  // Strict-Transport-Security (HSTS) - only in production
  if (!isDevelopment) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  // Store nonce in header for use in the app
  headers.set("X-CSP-Nonce", nonce);

  return NextResponse.next({
    headers,
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
