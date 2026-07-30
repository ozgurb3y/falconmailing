import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "falcon_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is not configured securely.");
  }
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAdminSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return false;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return false;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { role?: string; exp?: number };
    return (
      decoded.role === "admin" &&
      typeof decoded.exp === "number" &&
      decoded.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function verifyAdminPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD_HASH;
  if (!configured) {
    throw new Error("ADMIN_PASSWORD_HASH is not configured.");
  }
  const [saltHex, expectedHex] = configured.split(":");
  if (!saltHex || !expectedHex) return false;

  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(expectedHex, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = new URL(
    process.env.APP_URL || "https://falconmailing.com",
  ).origin;
  return origin === expected;
}

