import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailSchema = z.string().trim().email().max(254);

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  const parsed = emailSchema.safeParse(
    new URL(request.url).searchParams.get("email"),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }

  await ensureDatabaseSchema();
  const sql = db();
  const email = parsed.data.toLowerCase();
  const [deliveryRows, suppressionRows] = await Promise.all([
    sql`
      SELECT
        campaigns.id AS campaign_id,
        campaigns.subject,
        campaigns.status AS campaign_status,
        campaigns.created_at AS campaign_created_at,
        recipients.status AS recipient_status,
        recipients.delivery_status,
        recipients.attempt_count,
        recipients.sent_at,
        recipients.delivered_at,
        recipients.last_delivery_event_at,
        recipients.ses_message_id,
        recipients.error_message,
        recipients.delivery_event_detail
      FROM campaign_recipients recipients
      JOIN campaigns ON campaigns.id = recipients.campaign_id
      WHERE lower(recipients.email) = ${email}
      ORDER BY campaigns.created_at DESC
      LIMIT 20
    `,
    sql`
      SELECT reason, source, created_at
      FROM email_suppressions
      WHERE lower(email) = ${email}
      ORDER BY created_at DESC
    `,
  ]);

  return NextResponse.json(
    {
      email,
      suppressed: suppressionRows.length > 0,
      suppressions: suppressionRows,
      deliveries: deliveryRows,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
