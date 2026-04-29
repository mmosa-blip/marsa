import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM helpers for record-system secrets (platform passwords,
 * SENSITIVE_DATA payloads, 2FA recovery codes).
 *
 * Output format: base64( iv(12) ‖ tag(16) ‖ ciphertext ).
 *
 * Key resolution, in order:
 *   1. process.env.RECORD_SECRETS_KEY — preferred. 32 bytes, hex (64 chars)
 *      or base64 (44 chars) or raw utf8 (≥32 chars).
 *   2. derived from NEXTAUTH_SECRET via scrypt — dev fallback only.
 *
 * Production deployments MUST set RECORD_SECRETS_KEY explicitly.
 */

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = process.env.RECORD_SECRETS_KEY;
  if (explicit) {
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
      cachedKey = Buffer.from(explicit, "hex");
    } else if (/^[A-Za-z0-9+/=]{44}$/.test(explicit)) {
      cachedKey = Buffer.from(explicit, "base64");
    } else if (explicit.length >= 32) {
      cachedKey = Buffer.from(explicit.slice(0, 32), "utf8");
    } else {
      throw new Error(
        "RECORD_SECRETS_KEY must be 32 bytes (64 hex / 44 base64 / ≥32 chars utf8)"
      );
    }
    return cachedKey;
  }
  const fallback = process.env.NEXTAUTH_SECRET;
  if (!fallback) {
    throw new Error(
      "Either RECORD_SECRETS_KEY or NEXTAUTH_SECRET must be set to encrypt record secrets"
    );
  }
  // Deterministic but not ideal — only used when no explicit key is provided.
  cachedKey = scryptSync(fallback, "marsa-record-secrets", 32);
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < 28) throw new Error("ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/**
 * Mask any string for display. Returns the first/last char with a fixed
 * middle so the UI can hint at the credential without revealing it.
 */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 2) return "•".repeat(value.length);
  return `${value[0]}${"•".repeat(Math.min(value.length - 2, 8))}${value[value.length - 1]}`;
}
