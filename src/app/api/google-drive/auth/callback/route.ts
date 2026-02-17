import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { exchangeCodeForTokens, storeTokens } from "@/lib/google-auth";

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
  });

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
    window.location.href = "/integrations";
  }
</script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "Authentication required. Please sign in and try again.",
      }),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  const { userId } = authResult;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: `Google denied access: ${oauthError}`,
      }),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!code) {
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error: "No authorisation code received from Google",
      }),
      { status: 200, headers: { "Content-Type": "text/html" } },
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
        { status: 200, headers: { "Content-Type": "text/html" } },
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
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return new NextResponse(
      buildCallbackHtml({
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to complete Google Drive authorisation",
      }),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }
}
