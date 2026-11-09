/**
 * Xero app settings from the environment. New Xero apps (created on or after
 * 2 March 2026) only accept the granular accounting scopes, so the default
 * asks for invoices and attachments (needed to push drafts later), read-only
 * settings (items) and read-only contacts. XERO_SCOPES overrides the list.
 */
export const DEFAULT_XERO_SCOPES = [
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts.read",
  "accounting.invoices",
  "accounting.attachments",
] as const;

export const XERO_AUTHORISE_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_REVOKE_URL = "https://identity.xero.com/connect/revocation";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
export const XERO_API_URL = "https://api.xero.com/api.xro/2.0";

export const XERO_ENCRYPTION_KEY_ENV_VAR = "XERO_ENCRYPTION_KEY";

export interface XeroAppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/** The environment variables still needed before Xero can be connected */
export function getMissingXeroEnvVars(): string[] {
  const required = [
    "XERO_CLIENT_ID",
    "XERO_CLIENT_SECRET",
    XERO_ENCRYPTION_KEY_ENV_VAR,
    "NEXT_PUBLIC_APP_URL",
  ];
  return required.filter((name) => !process.env[name]?.trim());
}

export function getXeroScopes(): string[] {
  const configured = process.env.XERO_SCOPES?.split(/[\s,]+/).filter(Boolean) ?? [];
  return configured.length > 0 ? configured : [...DEFAULT_XERO_SCOPES];
}

export function getXeroAppConfig(): XeroAppConfig {
  const missing = getMissingXeroEnvVars();
  if (missing.length > 0) {
    throw new Error(`Xero is not configured: set ${missing.join(", ")}`);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  return {
    clientId: process.env.XERO_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.XERO_CLIENT_SECRET?.trim() ?? "",
    redirectUri: `${appUrl}/api/xero/auth/callback`,
    scopes: getXeroScopes(),
  };
}
