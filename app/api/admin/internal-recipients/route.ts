import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isSameOrigin,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";

const recipientSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(100).optional().nullable(),
});

const importSchema = z.object({
  recipients: z.array(recipientSchema).min(1).max(500),
  authorized: z.literal(true),
});

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    const parsed = importSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Adresleri ve yetki beyanını kontrol edin." },
        { status: 400 },
      );
    }

    const unique = Array.from(
      new Map(
        parsed.data.recipients.map((recipient) => [
          recipient.email.toLowerCase(),
          {
            email: recipient.email.toLowerCase(),
            name: recipient.name || null,
          },
        ]),
      ).values(),
    );

    await ensureDatabaseSchema();
    const sql = db();
    const rows = await sql`
      WITH input AS (
        SELECT
          lower(trim(item.email)) AS email,
          nullif(trim(item.name), '') AS name
        FROM jsonb_to_recordset(${JSON.stringify(unique)}::jsonb)
          AS item(email TEXT, name TEXT)
      ),
      imported AS (
        INSERT INTO internal_recipients (
          id, email, name, status, source, added_by,
          authorization_note, created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          input.email,
          input.name,
          'active',
          'admin_internal_list',
          'admin',
          'Şirket içi iletişim yetkisi yönetici tarafından beyan edildi.',
          NOW(),
          NOW()
        FROM input
        ON CONFLICT ((lower(email))) DO UPDATE
        SET
          name = COALESCE(EXCLUDED.name, internal_recipients.name),
          updated_at = NOW()
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::int FROM imported) AS processed,
        (
          SELECT COUNT(*)::int
          FROM internal_recipients
          WHERE status = 'active'
        ) AS active
    `;

    return NextResponse.json({
      processed: Number(rows[0]?.processed || 0),
      active: Number(rows[0]?.active || 0),
    });
  } catch (error) {
    console.error("Internal recipient import failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Şirket içi adresler eklenemedi." },
      { status: 503 },
    );
  }
}

