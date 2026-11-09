import { randomBytes, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import type { XeroSyncResult } from "@/lib/xero/types";

/** Holds the `state` sent to Xero until the sign-in comes back to the callback */
export const XERO_STATE_COOKIE = "xero_oauth_state";

const STATE_COOKIE_PATH = "/api/xero/auth";
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

/** What the callback popup posts to the window that opened it */
export interface XeroCallbackPayload {
  success: boolean;
  tenantName: string | null;
  error: string | null;
  sync: XeroSyncResult | null;
  syncError: string | null;
}

function stateCookieOptions({ maxAge }: { maxAge: number }) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: STATE_COOKIE_PATH,
    maxAge,
  };
}

/** A random, URL-safe value tying the Xero sign-in to this browser */
export function createXeroOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function setXeroStateCookie({
  response,
  state,
}: {
  response: NextResponse;
  state: string;
}): void {
  response.cookies.set(
    XERO_STATE_COOKIE,
    state,
    stateCookieOptions({ maxAge: STATE_COOKIE_MAX_AGE_SECONDS }),
  );
}

export function clearXeroStateCookie({ response }: { response: NextResponse }): void {
  response.cookies.set(XERO_STATE_COOKIE, "", stateCookieOptions({ maxAge: 0 }));
}

/** Whether the `state` Xero returned matches the cookie, compared in constant time */
export function isXeroStateValid({
  expected,
  received,
}: {
  expected: string | undefined;
  received: string | undefined;
}): boolean {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
