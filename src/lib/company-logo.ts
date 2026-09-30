export type CompanyLogoAssets = {
  logoDataUrl: string;
  logoPublicUrl: string | null;
};

export const LOGO_FETCH_TIMEOUT_MS = 4000;

const VERCEL_BLOB_PUBLIC_HOST_SUFFIX = ".public.blob.vercel-storage.com";

const MAX_LOGO_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseHttpUrl({ value }: { value: string }): URL | null {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
}

function getTrustedLogoOrigin(): URL | null {
  const logoOrigin = process.env.LOGO_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (!logoOrigin) {
    return null;
  }

  const parsedLogoOrigin = parseHttpUrl({ value: logoOrigin });
  if (!parsedLogoOrigin) {
    console.error("Invalid logo origin configured. Expected an http(s) URL.");
    return null;
  }

  return parsedLogoOrigin;
}

function getAllowedLogoHosts({
  trustedLogoOrigin,
}: {
  trustedLogoOrigin: URL | null;
}): Set<string> {
  const allowedHosts = new Set<string>();
  if (trustedLogoOrigin) {
    allowedHosts.add(trustedLogoOrigin.hostname.toLowerCase());
  }

  const configuredHosts = process.env.LOGO_ALLOWED_HOSTS;
  if (!configuredHosts) {
    return allowedHosts;
  }

  for (const host of configuredHosts.split(",")) {
    const trimmedHost = host.trim().toLowerCase();
    if (trimmedHost.length > 0) {
      allowedHosts.add(trimmedHost);
    }
  }

  return allowedHosts;
}

function isVercelBlobLogoUrl({ logoUrl }: { logoUrl: URL }): boolean {
  return (
    logoUrl.protocol === "https:" &&
    logoUrl.hostname.toLowerCase().endsWith(VERCEL_BLOB_PUBLIC_HOST_SUFFIX)
  );
}

function getAllowedLogoHostsFromEnv(): Set<string> {
  return getAllowedLogoHosts({ trustedLogoOrigin: getTrustedLogoOrigin() });
}

function isAllowedLogoUrl({
  logoUrl,
  allowedLogoHosts,
}: {
  logoUrl: URL;
  allowedLogoHosts: Set<string>;
}): boolean {
  if (logoUrl.protocol !== "http:" && logoUrl.protocol !== "https:") {
    return false;
  }

  return (
    allowedLogoHosts.has(logoUrl.hostname.toLowerCase()) ||
    isVercelBlobLogoUrl({ logoUrl })
  );
}

function resolveLogoUrl({
  logo,
  trustedLogoOrigin,
}: {
  logo: string;
  trustedLogoOrigin: URL | null;
}): URL | null {
  const absoluteLogoUrl = parseHttpUrl({ value: logo });
  if (absoluteLogoUrl) {
    return absoluteLogoUrl;
  }

  if (!trustedLogoOrigin) {
    console.error(
      "Cannot resolve relative company logo path without a trusted logo origin.",
    );
    return null;
  }

  try {
    return new URL(logo, trustedLogoOrigin);
  } catch {
    console.error("Invalid company logo path.");
    return null;
  }
}

/**
 * Resolves the stored company logo value to a public URL that is safe to fetch.
 * Relative paths resolve against LOGO_ORIGIN (or NEXT_PUBLIC_APP_URL). The
 * resolved URL, absolute or relative, must be http(s) and on the trusted
 * origin's host, a host listed in LOGO_ALLOWED_HOSTS, or an https Vercel Blob
 * public store (where uploaded logos are kept).
 * Returns null when the logo cannot be resolved to an allowed URL.
 */
export function resolveCompanyLogoPublicUrl({
  companyLogo,
}: {
  companyLogo: string;
}): string | null {
  const trustedLogoOrigin = getTrustedLogoOrigin();
  const allowedLogoHosts = getAllowedLogoHosts({ trustedLogoOrigin });

  const logoUrl = resolveLogoUrl({
    logo: companyLogo.trim(),
    trustedLogoOrigin,
  });
  if (!logoUrl) {
    return null;
  }

  if (!isAllowedLogoUrl({ logoUrl, allowedLogoHosts })) {
    console.error("Blocked company logo URL outside allowed hosts.");
    return null;
  }

  return logoUrl.toString();
}

/**
 * Fetches a logo without letting redirects leave the allow-list: each redirect
 * is followed manually, and only when its target passes the same host check.
 * Returns null when a redirect is missing, disallowed or exceeds the limit.
 */
async function fetchLogoWithAllowedRedirects({
  url,
  signal,
  allowedLogoHosts,
  redirectsLeft,
}: {
  url: string;
  signal: AbortSignal;
  allowedLogoHosts: Set<string>;
  redirectsLeft: number;
}): Promise<Response | null> {
  const response = await fetch(url, { signal, redirect: "manual" });
  if (!REDIRECT_STATUSES.has(response.status)) {
    return response;
  }

  await response.body?.cancel();

  const location = response.headers.get("location");
  if (!location || redirectsLeft === 0) {
    console.error(
      "Error fetching logo file: redirect without a location or too many redirects",
    );
    return null;
  }

  const redirectUrl = parseRedirectUrl({ location, baseUrl: url });
  if (
    !redirectUrl ||
    !isAllowedLogoUrl({ logoUrl: redirectUrl, allowedLogoHosts })
  ) {
    console.error("Blocked company logo redirect outside allowed hosts.");
    return null;
  }

  return fetchLogoWithAllowedRedirects({
    url: redirectUrl.toString(),
    signal,
    allowedLogoHosts,
    redirectsLeft: redirectsLeft - 1,
  });
}

function parseRedirectUrl({
  location,
  baseUrl,
}: {
  location: string;
  baseUrl: string;
}): URL | null {
  try {
    return new URL(location, baseUrl);
  } catch {
    return null;
  }
}

async function fetchLogoDataUrl({
  logoPublicUrl,
}: {
  logoPublicUrl: string;
}): Promise<string> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, LOGO_FETCH_TIMEOUT_MS);

  try {
    const logoResponse = await fetchLogoWithAllowedRedirects({
      url: logoPublicUrl,
      signal: abortController.signal,
      allowedLogoHosts: getAllowedLogoHostsFromEnv(),
      redirectsLeft: MAX_LOGO_REDIRECTS,
    });
    if (!logoResponse) {
      return "";
    }
    if (!logoResponse.ok) {
      console.error("Error fetching logo file:", logoResponse.statusText);
      return "";
    }

    const contentType = logoResponse.headers.get("content-type") || "image/png";
    const logoArrayBuffer = await logoResponse.arrayBuffer();
    const logoBase64 = Buffer.from(logoArrayBuffer).toString("base64");

    return `data:${contentType};base64,${logoBase64}`;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(
        `Error fetching logo file: request timed out after ${LOGO_FETCH_TIMEOUT_MS}ms`,
      );
      return "";
    }

    console.error("Error fetching logo file:", error);
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Builds the company logo assets used by PDF and email generation.
 * `logoDataUrl` is a base64 data URL for embedding in PDFs (empty string when
 * unavailable); `logoPublicUrl` is the resolved, allow-listed URL for email HTML.
 */
export async function buildCompanyLogoAssets({
  companyLogo,
}: {
  companyLogo: string | null;
}): Promise<CompanyLogoAssets> {
  if (!companyLogo) {
    return { logoDataUrl: "", logoPublicUrl: null };
  }

  const logoPublicUrl = resolveCompanyLogoPublicUrl({ companyLogo });
  if (!logoPublicUrl) {
    return { logoDataUrl: "", logoPublicUrl: null };
  }

  const logoDataUrl = await fetchLogoDataUrl({ logoPublicUrl });

  return {
    logoDataUrl,
    logoPublicUrl,
  };
}
