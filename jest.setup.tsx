import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll, vi } from "vitest";

(globalThis as unknown as { jest?: typeof vi }).jest = vi;
import { Crypto } from "@peculiar/webcrypto";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for jsdom
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Polyfill crypto for Prisma v7 adapter in jsdom environment
if (
  typeof global.crypto === "undefined" ||
  typeof global.crypto.getRandomValues === "undefined"
) {
  const crypto = new Crypto();
  global.crypto = crypto as unknown as Crypto & typeof globalThis.crypto;
}

// Set test environment
// Use try-catch to handle node-single-context environment where defineProperty may fail
try {
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch {
  // In node-single-context environment, use bracket notation to bypass TypeScript read-only check
  (process.env as Record<string, string | undefined>)["NODE_ENV"] = "test";
}
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
// Suppress dotenv logging
process.env.DOTENV_QUIET = "true";

// Suppress console output in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress most console output
  console.log = vi.fn();
  console.warn = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();

  // Keep error but filter out expected warnings
  console.error = vi.fn((...args: unknown[]) => {
    const message = args[0]?.toString() || "";

    // Filter out known warnings we don't care about in tests
    const suppressedPatterns = [
      "Warning: Missing `Description`",
      "Warning: ReactDOM.render",
      "Error fetching",
      "Failed to",
      "Error extracting filename from URL", // Expected error from tests
      "Invalid URL", // Expected error from validation tests
      "Invalid time format:", // Expected error from convertToISODateTime rejecting non-quarter-hour times
    ];

    if (suppressedPatterns.some((pattern) => message.includes(pattern))) {
      return;
    }

    // Show actual errors
    originalConsoleError.apply(console, args);
  });
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test123",
      firstName: "Test",
      lastName: "User",
      emailAddresses: [{ emailAddress: "test@example.com" }],
    },
    isLoaded: true,
    isSignedIn: true,
  }),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  UserButton: () => <div data-testid="user-button">User Button</div>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  auth: () => ({ userId: "user_test123" }),
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Essential global mocks
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

if (global.Element?.prototype) {
  global.Element.prototype.scrollIntoView = vi.fn();
}
