import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

/**
 * Require a signed-in user who may manage RCTIs, deductions and RCTI settings.
 * Returns the auth result on success, or a 401/403 response to return as-is.
 */
export async function requireRctiAccess({
  headers,
}: {
  headers?: HeadersInit;
} = {}) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const hasAccess = await checkPermission("manage_jobs_report");
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden - Insufficient permissions to manage RCTIs" },
      { status: 403, headers },
    );
  }

  return authResult;
}
