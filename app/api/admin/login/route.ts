import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSessionToken,
  isSameOrigin,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { getRequestIp, hashPersonalData } from "@/lib/security";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(8).max(256),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ message: "Geçersiz istek." }, { status: 403 });
    }

    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Parola geçersiz." },
        { status: 400 },
      );
    }

    await ensureDatabaseSchema();
    const sql = db();
    const ipHash = hashPersonalData(getRequestIp(request.headers));
    const attempts = await sql`
      SELECT COUNT(*)::int AS count
      FROM admin_login_attempts
      WHERE ip_hash = ${ipHash}
        AND successful = FALSE
        AND created_at > NOW() - INTERVAL '15 minutes'
    `;
    if (Number(attempts[0]?.count || 0) >= 8) {
      return NextResponse.json(
        { message: "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin." },
        { status: 429 },
      );
    }

    const successful = verifyAdminPassword(parsed.data.password);
    await sql`
      INSERT INTO admin_login_attempts (id, ip_hash, successful, created_at)
      VALUES (${randomUUID()}, ${ipHash}, ${successful}, NOW())
    `;

    if (!successful) {
      return NextResponse.json(
        { message: "Parola hatalı." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      ADMIN_COOKIE_NAME,
      createAdminSessionToken(),
      adminCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Admin login failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Giriş şu anda tamamlanamadı." },
      { status: 503 },
    );
  }
}

