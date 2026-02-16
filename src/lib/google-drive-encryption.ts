import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.GOOGLE_DRIVE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_DRIVE_ENCRYPTION_KEY environment variable is required for token encryption",
    );
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "GOOGLE_DRIVE_ENCRYPTION_KEY must be a 32-byte key encoded as base64 (44 characters)",
    );
  }

  return keyBuffer;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encryptToken({ token }: { token: string }): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptToken({
  encrypted,
  iv,
  tag,
}: {
  encrypted: string;
  iv: string;
  tag: string;
}): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}
