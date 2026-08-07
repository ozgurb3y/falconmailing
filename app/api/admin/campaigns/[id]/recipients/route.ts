import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated, isSameOrigin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const emailAddressSchema = z.string().trim().email().max(254);
const uploadSchema = z.object({
  startIndex: z.number().int().nonnegative(),
  recipients: z
    .array(
      z.object({
        email: z.string().trim().min(1).max(10_000),
        name: z.string().trim().max(100).optional().nullable(),
      }),
    )
    .min(1)
    .max(5_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    const parsed = uploadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Alıcı grubundaki alanları kontrol edin." },
        { status: 400 },
      );
    }

    await ensureDatabaseSchema();
    const { id } = await params;
    const sql = db();
    const campaignRows = await sql`
      SELECT id FROM campaigns
      WHERE id = ${id} AND status = 'draft' AND audience_type = 'internal'
      LIMIT 1
    `;
    if (campaignRows.length === 0) {
      return NextResponse.json(
        { message: "Alıcı eklenebilecek taslak kampanya bulunamadı." },
        { status: 409 },
      );
    }

    const recipients = parsed.data.recipients.map((recipient, index) => ({
      email: recipient.email,
      name: recipient.name || null,
      sendOrder: parsed.data.startIndex + index + 1,
      isValid: emailAddressSchema.safeParse(recipient.email).success,
    }));
    await sql`
      INSERT INTO campaign_recipients (
        id, campaign_id, contact_id, internal_recipient_id,
        email, name, send_order, status, error_message,
        created_at, updated_at
      )
      SELECT
        gen_random_uuid(), ${id}, NULL, NULL,
        lower(trim(input.email)), nullif(trim(input.name), ''),
        input."sendOrder",
        CASE WHEN input."isValid" THEN 'queued' ELSE 'failed' END,
        CASE
          WHEN input."isValid" THEN NULL
          ELSE 'Geçersiz e-posta adresi; gönderim yapılmadı.'
        END,
        NOW(), NOW()
      FROM jsonb_to_recordset(${JSON.stringify(recipients)}::jsonb)
        AS input(
          email TEXT, name TEXT, "sendOrder" INTEGER, "isValid" BOOLEAN
        )
      ON CONFLICT (campaign_id, send_order) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
    `;
    const rows = await sql`
      WITH totals AS (
        SELECT
          COUNT(*)::int AS audience_count,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
        FROM campaign_recipients
        WHERE campaign_id = ${id}
      )
      UPDATE campaigns
      SET audience_count = totals.audience_count,
          failed_count = totals.failed_count,
          updated_at = NOW()
      FROM totals
      WHERE campaigns.id = ${id}
      RETURNING campaigns.audience_count, campaigns.failed_count
    `;

    return NextResponse.json({
      audienceCount: Number(rows[0]?.audience_count || 0),
      failedCount: Number(rows[0]?.failed_count || 0),
    });
  } catch (error) {
    console.error("Campaign recipient upload failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Alıcı grubu kampanyaya eklenemedi." },
      { status: 503 },
    );
  }
}
