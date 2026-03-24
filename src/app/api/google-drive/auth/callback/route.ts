import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { exchangeCodeForTokens, storeTokens } from "@/lib/google-auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "Authentication required. Please sign in and try again.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...rateLimitResult.headers,
        },
      },
    );
  }

  const { userId } = authResult;
  const { searchParams } = new URL(request.url);

  const parseResult = callbackQuerySchema.safeParse({
    code: searchParams.get("code") ?? undefined,
    error: searchParams.get("error") ?? undefined,
  });

  if (!parseResult.success) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "Invalid callback parameters",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...rateLimitResult.headers,
        },
      },
    );
  }

  const { code, error: oauthError } = parseResult.data;

  if (oauthError) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "Google denied access. Please try again.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...rateLimitResult.headers,
        },
      },
    );
  }

  if (!code) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "No authorisation code received from Google",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...rateLimitResult.headers,
        },
      },
    );
  }

  try {
    const role = await getUserRole(userId);

    if (role !== "admin") {
      return new NextResponse(
        buildCallbackHtml({
          success: false,
          error: "Only administrators can connect Google Drive",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            ...rateLimitResult.headers,
          },
        },
      );
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

    return new NextResponse(buildCallbackHtml({ success: true, email }), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        ...rateLimitResult.headers,
      },
    });
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "Failed to complete Google Drive authorisation",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...rateLimitResult.headers,
        },
      },
    );
  }
}
