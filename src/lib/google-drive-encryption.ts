import {
  decryptTokenWithKey,
  encryptTokenWithKey,
  type EncryptedToken,
} from "@/lib/token-encryption";

const KEY_ENV_VAR = "GOOGLE_DRIVE_ENCRYPTION_KEY";

export function encryptToken({ token }: { token: string }): EncryptedToken {
  return encryptTokenWithKey({ token, keyEnvVar: KEY_ENV_VAR });
}

export function decryptToken({ encrypted, iv, tag }: EncryptedToken): string {
  return decryptTokenWithKey({ encrypted, iv, tag, keyEnvVar: KEY_ENV_VAR });
}
