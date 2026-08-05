import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export type UnsubscribeTarget = {
  contactId: string | null;
  internalRecipientId: string | null;
  recipientEmail: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unsubscribeEncryptionKey() {
  const secret =
    process.env.CONSENT_HASH_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Unsubscribe encryption secret is not configured securely.");
  }
  return createHash("sha256")
    .update("falconmailing:unsubscribe:v1:")
    .update(secret)
    .digest();
}

export function createUnsubscribeToken(target: UnsubscribeTarget) {
  const payload = JSON.stringify({
    c: target.contactId || undefined,
    i: target.internalRecipientId || undefined,
    e:
      !target.contactId && !target.internalRecipientId
        ? target.recipientEmail?.trim().toLowerCase()
        : undefined,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", unsubscribeEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return [
    "u1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function readUnsubscribeToken(token: string): UnsubscribeTarget | null {
  try {
    const [version, ivPart, encryptedPart, tagPart, extra] = token.split(".");
    if (version !== "u1" || !ivPart || !encryptedPart || !tagPart || extra) {
      return null;
    }
    const iv = Buffer.from(ivPart, "base64url");
    const encrypted = Buffer.from(encryptedPart, "base64url");
    const authTag = Buffer.from(tagPart, "base64url");
    if (
      iv.length !== 12 ||
      authTag.length !== 16 ||
      iv.toString("base64url") !== ivPart ||
      encrypted.toString("base64url") !== encryptedPart ||
      authTag.toString("base64url") !== tagPart
    ) {
      return null;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      unsubscribeEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    const decoded = JSON.parse(
      Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8"),
    ) as { c?: unknown; i?: unknown; e?: unknown };
    const contactId = typeof decoded.c === "string" ? decoded.c : null;
    const internalRecipientId = typeof decoded.i === "string" ? decoded.i : null;
    const recipientEmail = typeof decoded.e === "string" ? decoded.e : null;
    if (
      (contactId && !UUID_PATTERN.test(contactId)) ||
      (internalRecipientId && !UUID_PATTERN.test(internalRecipientId)) ||
      (contactId && internalRecipientId) ||
      (!contactId && !internalRecipientId &&
        (!recipientEmail || recipientEmail.length > 320 || !recipientEmail.includes("@")))
    ) {
      return null;
    }
    return { contactId, internalRecipientId, recipientEmail };
  } catch {
    return null;
  }
}

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
