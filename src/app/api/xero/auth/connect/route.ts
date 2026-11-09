import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { buildXeroAuthorisationUrl } from "@/lib/xero/auth";
import { getMissingXeroEnvVars } from "@/lib/xero/config";
import { createXeroOAuthState, setXeroStateCookie } from "@/lib/xero/oauth-state";

/**
 * GET /api/xero/auth/connect
 * The Xero sign-in URL, with its state stored in a short-lived cookie
 */
export const GET = apiRoute({
  auth: { permission: "manage_integrations" },
  errorMessage: "Failed to generate Xero auth URL",
  responseMessage: "Failed to start the Xero connection",
  handler: async () => {
    const missingEnvVars = getMissingXeroEnvVars();
    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          error: `Xero is not configured. Set ${missingEnvVars.join(", ")}.`,
          missingEnvVars,
        },
        { status: 400 },
      );
    }

    const state = createXeroOAuthState();
    const response = NextResponse.json({ authUrl: buildXeroAuthorisationUrl({ state }) });
    setXeroStateCookie({ response, state });
    return response;
  },
});
