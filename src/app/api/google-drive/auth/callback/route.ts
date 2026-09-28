import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { exchangeCodeForTokens, storeTokens } from "@/lib/google-auth";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().max(200).optional(),
});

function buildCallbackHtml({
  success,
  email,
  error,
}: {
  success: boolean;
  email?: string;
  error?: string;
}): string {
  const payload = JSON.stringify({
    success,
    email: email || null,
    error: error || null,
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head><title>Google Drive Connection</title></head>
<body>
<p>Completing connection...</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "google-drive-callback", payload: ${payload} }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/settings/admin/integrations";
  }
</script>
</body>
</html>`;
}

function callbackResponse({
  success,
  email,
  error,
}: {
  success: boolean;
  email?: string;
  error?: string;
}) {
  return new NextResponse(buildCallbackHtml({ success, email, error }), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * The callback runs in a popup, so a signed-out user gets the result page
 * rather than a JSON 401
 */
async function requireAuthForCallback() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return callbackResponse({
      success: false,
      error: "Authentication required. Please sign in and try again.",
    });
  }
  return authResult;
}

export const GET = apiRoute({
  auth: requireAuthForCallback,
  errorMessage: "Google Drive OAuth callback error",
  handler: async ({ request, userId }) => {
    const { searchParams } = new URL(request.url);

    const parseResult = callbackQuerySchema.safeParse({
      code: searchParams.get("code") ?? undefined,
      error: searchParams.get("error") ?? undefined,
    });

    if (!parseResult.success) {
      return callbackResponse({
        success: false,
        error: "Invalid callback parameters",
      });
    }

    const { code, error: oauthError } = parseResult.data;

    if (oauthError) {
      return callbackResponse({
        success: false,
        error: "Google denied access. Please try again.",
      });
    }

    if (!code) {
      return callbackResponse({
        success: false,
        error: "No authorisation code received from Google",
      });
    }

    try {
      const role = await getUserRole(userId);

      if (role !== "admin") {
        return callbackResponse({
          success: false,
          error: "Only administrators can connect Google Drive",
        });
      }

      const { accessToken, refreshToken, expiry, email } =
        await exchangeCodeForTokens({ code });

      await storeTokens({
        userId,
        email,
        accessToken,
        refreshToken,
        expiry,
      });

      return callbackResponse({ success: true, email });
    } catch (err) {
      console.error("Google Drive OAuth callback error:", err);
      return callbackResponse({
        success: false,
        error: "Failed to complete Google Drive authorisation",
      });
    }
  },
});
