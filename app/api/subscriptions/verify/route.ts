import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { hashToken } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(32).max(256),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Doğrulama bağlantısı geçersiz." },
        { status: 400 },
      );
    }

    await ensureDatabaseSchema();
    const sql = db();
    const tokenHash = hashToken(parsed.data.token);
    const rows = await sql`
      WITH target AS (
        SELECT token_hash, contact_id, consent_id
        FROM verification_tokens
        WHERE token_hash = ${tokenHash}
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      ),
      verified_contact AS (
        UPDATE contacts
        SET
          status = CASE WHEN status = 'suppressed' THEN status ELSE 'active' END,
          email_verified_at = CASE
            WHEN status = 'suppressed' THEN email_verified_at
            ELSE COALESCE(email_verified_at, NOW())
          END,
          unsubscribed_at = CASE
            WHEN status = 'suppressed' THEN unsubscribed_at
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = (SELECT contact_id FROM target)
          AND status != 'suppressed'
        RETURNING id
      ),
      granted_consent AS (
        UPDATE consents
        SET
          status = 'granted',
          confirmed_at = COALESCE(confirmed_at, NOW())
        WHERE id = (SELECT consent_id FROM target)
          AND EXISTS (SELECT 1 FROM verified_contact)
        RETURNING id
      )
      UPDATE verification_tokens
      SET used_at = NOW()
      WHERE token_hash = (SELECT token_hash FROM target)
        AND EXISTS (SELECT 1 FROM granted_consent)
      RETURNING contact_id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          message:
            "Bu bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Verification failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Doğrulama şu anda tamamlanamadı. Lütfen tekrar deneyin." },
      { status: 503 },
    );
  }
}
