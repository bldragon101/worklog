import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";
import { ApiError, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { completeXeroAuthorisation } from "@/lib/xero/auth";
import {
  clearXeroStateCookie,
  isXeroStateValid,
  XERO_STATE_COOKIE,
  type XeroCallbackPayload,
} from "@/lib/xero/oauth-state";
import { syncXeroItemsAndContacts } from "@/lib/xero/sync";
import type { XeroSyncResult } from "@/lib/xero/types";

const callbackQuerySchema = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().max(200).optional(),
});

function buildCallbackHtml({ payload }: { payload: XeroCallbackPayload }): string {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head><title>Xero Connection</title></head>
<body>
<p>Completing connection...</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "xero-callback", payload: ${json} }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/settings/admin/integrations";
  }
</script>
</body>
</html>`;
}

/** The result page for the popup; the state cookie is always cleared */
function callbackResponse({ payload }: { payload: XeroCallbackPayload }): NextResponse {
  const response = new NextResponse(buildCallbackHtml({ payload }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  clearXeroStateCookie({ response });
  return response;
}

function failureResponse({ error }: { error: string }): NextResponse {
  return callbackResponse({
    payload: { success: false, tenantName: null, error, sync: null, syncError: null },
  });
}

/**
 * The callback runs in a popup, so a signed-out user gets the result page
 * rather than a JSON 401
 */
async function requireAuthForCallback() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) {
    return failureResponse({ error: "Authentication required. Please sign in and try again." });
  }
  return authResult;
}

async function logConnected({
  tenantName,
  request,
}: {
  tenantName: string;
  request: Parameters<typeof logActivity>[0]["request"];
}): Promise<void> {
  try {
    const connection = await prisma.xeroConnection.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    await logActivity({
      action: "CREATE",
      tableName: "XeroConnection",
      recordId: String(connection?.id ?? ""),
      newData: { tenantName },
      description: `Connected Xero organisation: ${tenantName}`,
      request,
    });
  } catch (error) {
    console.error("Failed to log Xero connection activity:", error);
  }
}

/**
 * GET /api/xero/auth/callback
 * Where Xero returns after sign-in: stores the connection, then syncs items
 * and contacts. A failed sync still reports the connection as successful.
 */
export const GET = apiRoute({
  auth: requireAuthForCallback,
  errorMessage: "Xero OAuth callback error",
  handler: async ({ request, userId }) => {
    const { searchParams } = request.nextUrl;
    const parsed = callbackQuerySchema.safeParse({
      code: searchParams.get("code") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      error: searchParams.get("error") ?? undefined,
    });
    if (!parsed.success) {
      return failureResponse({ error: "Invalid callback parameters" });
    }

    const { code, state, error: oauthError } = parsed.data;

    if (
      !isXeroStateValid({
        expected: request.cookies.get(XERO_STATE_COOKIE)?.value,
        received: state,
      })
    ) {
      return failureResponse({
        error: "The Xero sign-in could not be verified or has expired. Please try again.",
      });
    }

    if (oauthError) {
      return failureResponse({ error: "Xero access was not granted. Please try again." });
    }

    if (!code) {
      return failureResponse({ error: "No authorisation code received from Xero" });
    }

    if (!(await checkPermission("manage_integrations"))) {
      return failureResponse({ error: "Only administrators can connect Xero" });
    }

    let tenantName: string;
    try {
      ({ tenantName } = await completeXeroAuthorisation({ code, userId }));
    } catch (error) {
      if (error instanceof ApiError) {
        return failureResponse({ error: error.message });
      }
      console.error(
        "Xero OAuth callback error:",
        error instanceof Error ? error.message : String(error),
      );
      return failureResponse({ error: "Failed to complete Xero authorisation" });
    }

    await logConnected({ tenantName, request });

    let sync: XeroSyncResult | null = null;
    let syncError: string | null = null;
    try {
      sync = await syncXeroItemsAndContacts();
    } catch (error) {
      console.error(
        "Xero sync after connecting failed:",
        error instanceof Error ? error.message : String(error),
      );
      syncError =
        error instanceof ApiError
          ? error.message
          : "Items and contacts could not be synced from Xero. Use Sync to try again.";
    }

    return callbackResponse({
      payload: { success: true, tenantName, error: null, sync, syncError },
    });
  },
});
