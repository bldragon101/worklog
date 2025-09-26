/**
 * Generate a random nonce for CSP
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export function generateNonce(): string {
  // Use Web Crypto API (available in Edge Runtime and modern browsers)
  // Generate a random UUID and convert to base64-like string
  const uuid = crypto.randomUUID();
  // Remove hyphens and take first 22 chars for a proper nonce
  return uuid.replace(/-/g, "").slice(0, 22);
}

/**
 * Store for request-specific nonces
 * In production, use a proper request context or headers
 */
const nonceStore = new Map<string, string>();

/**
 * Get or create a nonce for the current request
 */
export function getRequestNonce(requestId: string): string {
  let nonce = nonceStore.get(requestId);
  if (!nonce) {
    nonce = generateNonce();
    nonceStore.set(requestId, nonce);
    // Clean up old nonces after 5 minutes
    setTimeout(() => nonceStore.delete(requestId), 5 * 60 * 1000);
  }
  return nonce;
}

/**
 * Generate Content Security Policy with nonce
 */
export function generateCSP(
  nonce: string,
  isDevelopment: boolean = false,
): string {
  const baseCSP = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Only allow unsafe-eval in development for React Fast Refresh
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
      // Allow specific trusted CDNs if needed
      "https://cdn.clerk.io",
      "https://challenges.cloudflare.com",
    ],
    "style-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Allow specific trusted CDNs for styles
      "https://fonts.googleapis.com",
    ],
    "img-src": ["'self'", "data:", "https:", "blob:"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      "https://api.clerk.io",
      "https://*.clerk.accounts.dev",
      "https://accounts.google.com",
      "https://www.googleapis.com",
      // Add your API endpoints
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [process.env.NEXT_PUBLIC_API_URL]
        : []),
    ],
    "frame-src": [
      "'self'",
      "https://challenges.cloudflare.com",
      "https://accounts.google.com",
    ],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": [],
  };

  // Build CSP string
  return Object.entries(baseCSP)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}

/**
 * CSP Report URI configuration
 */
export const CSP_REPORT_URI = process.env.CSP_REPORT_URI || null;

/**
 * Get complete CSP header with reporting
 */
export function getCSPHeader(
  nonce: string,
  isDevelopment: boolean = false,
): string {
  let csp = generateCSP(nonce, isDevelopment);

  // Add report-uri if configured
  if (CSP_REPORT_URI && !isDevelopment) {
    csp += `; report-uri ${CSP_REPORT_URI}`;
  }

  return csp;
}
