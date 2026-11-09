import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  tag: string;
}

function getEncryptionKey({ keyEnvVar }: { keyEnvVar: string }): Buffer {
  const key = process.env[keyEnvVar];
  if (!key) {
    throw new Error(`${keyEnvVar} environment variable is required for token encryption`);
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(`${keyEnvVar} must be a 32-byte key encoded as base64 (44 characters)`);
  }

  return keyBuffer;
}

/** AES-256-GCM encrypts a token with the base64 key in the given environment variable */
export function encryptTokenWithKey({
  token,
  keyEnvVar,
}: {
  token: string;
  keyEnvVar: string;
}): EncryptedToken {
  const key = getEncryptionKey({ keyEnvVar });
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(token, "utf8", "base64");
  encrypted += cipher.final("base64");

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** Decrypts a token encrypted by `encryptTokenWithKey` with the same key */
export function decryptTokenWithKey({
  encrypted,
  iv,
  tag,
  keyEnvVar,
}: EncryptedToken & { keyEnvVar: string }): string {
  const key = getEncryptionKey({ keyEnvVar });
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
