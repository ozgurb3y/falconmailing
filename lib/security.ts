import { createHash, createHmac, randomBytes } from "node:crypto";

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPersonalData(value: string) {
  const secret =
    process.env.CONSENT_HASH_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!secret || secret.length < 32) {
    throw new Error("Consent hashing secret is not configured securely.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

export function getRequestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
