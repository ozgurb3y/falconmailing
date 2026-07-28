import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSENT_SOURCE, CONSENT_TEXT_VERSION, VERIFICATION_TTL_HOURS } from "@/lib/constants";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";
import { ensureDatabaseSchema } from "@/lib/schema";
import {
  createToken,
  getRequestIp,
  hashPersonalData,
  hashToken,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(254),
  marketingConsent: z.literal(true),
  company: z.string().max(0).optional().nullable(),
});

function genericSuccess() {
  return NextResponse.json({
    message:
      "Adres uygunsa doğrulama e-postası gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.",
  });
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: "E-posta adresini ve açık izin kutusunu kontrol edin." },
        { status: 400 },
      );
    }

    if (parsed.data.company) {
      return genericSuccess();
    }

    await ensureDatabaseSchema();
    const sql = db();
    const email = parsed.data.email.toLowerCase();
    const ipHash = hashPersonalData(getRequestIp(request.headers));
    const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 500);

    const recentAttempts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip_count,
        COUNT(*) FILTER (WHERE lower(c.email) = ${email})::int AS email_count
      FROM consents co
      JOIN contacts c ON c.id = co.contact_id
      WHERE co.requested_at > NOW() - INTERVAL '1 hour'
    `;
    const attempt = recentAttempts[0] as { ip_count: number; email_count: number };

    if (attempt.ip_count >= 10 || attempt.email_count >= 3) {
      return genericSuccess();
    }

    const existingRows = await sql`
      SELECT id, status
      FROM contacts
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    const existing = existingRows[0] as
      | { id: string; status: string }
      | undefined;

    if (existing?.status === "active" || existing?.status === "suppressed") {
      return genericSuccess();
    }

    const contactId = existing?.id || randomUUID();
    const consentId = randomUUID();
    const token = createToken();
    const tokenHash = hashToken(token);

    await sql`
      INSERT INTO contacts (id, email, name, status, created_at, updated_at)
      VALUES (
        ${contactId},
        ${email},
        ${parsed.data.name || null},
        'pending',
        NOW(),
        NOW()
      )
      ON CONFLICT ((lower(email))) DO UPDATE
      SET
        name = COALESCE(EXCLUDED.name, contacts.name),
        status = CASE
          WHEN contacts.status = 'suppressed' THEN 'suppressed'
          WHEN contacts.status = 'active' THEN 'active'
          ELSE 'pending'
        END,
        updated_at = NOW()
    `;

    await sql`
      INSERT INTO consents (
        id,
        contact_id,
        status,
        channel,
        purpose,
        text_version,
        source,
        ip_hash,
        user_agent,
        requested_at
      )
      VALUES (
        ${consentId},
        ${contactId},
        'pending',
        'email',
        'marketing',
        ${CONSENT_TEXT_VERSION},
        ${CONSENT_SOURCE},
        ${ipHash},
        ${userAgent},
        NOW()
      )
    `;

    await sql`
      UPDATE verification_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE contact_id = ${contactId}
        AND used_at IS NULL
    `;

    await sql`
      INSERT INTO verification_tokens (
        token_hash,
        contact_id,
        consent_id,
        expires_at,
        created_at
      )
      VALUES (
        ${tokenHash},
        ${contactId},
        ${consentId},
        NOW() + (${VERIFICATION_TTL_HOURS} * INTERVAL '1 hour'),
        NOW()
      )
    `;

    await sendVerificationEmail({
      email,
      name: parsed.data.name,
      token,
    });

    await sql`
      UPDATE verification_tokens
      SET sent_at = NOW()
      WHERE token_hash = ${tokenHash}
    `;

    return genericSuccess();
  } catch (error) {
    console.error("Subscription request failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        message:
          "Abonelik hizmeti şu anda geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
      },
      { status: 503 },
    );
  }
}
