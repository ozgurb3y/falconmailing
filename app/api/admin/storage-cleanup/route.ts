import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isSameOrigin,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const cleanupSchema = z.object({
  confirmation: z.literal("SES_HAM_OLAYLARINI_TEMIZLE"),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const parsed = cleanupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Onay metni geçersiz." }, { status: 400 });
  }

  const sql = db();
  const beforeRows = await sql`
    SELECT
      COUNT(*)::int AS event_count,
      pg_total_relation_size('ses_delivery_events')::bigint AS table_bytes,
      pg_database_size(current_database())::bigint AS database_bytes
    FROM ses_delivery_events
  `;

  await sql`TRUNCATE TABLE ses_delivery_events`;

  const afterRows = await sql`
    SELECT
      COUNT(*)::int AS event_count,
      pg_total_relation_size('ses_delivery_events')::bigint AS table_bytes,
      pg_database_size(current_database())::bigint AS database_bytes
    FROM ses_delivery_events
  `;
  await sql`
    INSERT INTO audit_logs (id, action, actor, metadata, created_at)
    VALUES (
      ${randomUUID()},
      'truncate_ses_delivery_events',
      'admin',
      ${JSON.stringify({ before: beforeRows[0], after: afterRows[0] })}::jsonb,
      NOW()
    )
  `;

  return NextResponse.json({
    cleaned: true,
    before: beforeRows[0],
    after: afterRows[0],
  });
}
