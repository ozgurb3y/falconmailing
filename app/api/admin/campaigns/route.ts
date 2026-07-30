import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isSameOrigin,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";

const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    subject: z.string().trim().min(3).max(180),
    previewText: z.string().trim().max(220).optional().nullable(),
    heading: z.string().trim().min(3).max(180),
    content: z.string().trim().min(10).max(20_000),
    ctaLabel: z.string().trim().max(80).optional().nullable(),
    ctaUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  })
  .refine(
    (value) =>
      (!value.ctaLabel && !value.ctaUrl) ||
      Boolean(value.ctaLabel && value.ctaUrl),
    { message: "Buton metni ve bağlantısı birlikte girilmelidir." },
  );

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    const parsed = campaignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Alanları kontrol edin." },
        { status: 400 },
      );
    }

    await ensureDatabaseSchema();
    const sql = db();
    const campaignId = randomUUID();
    const value = parsed.data;
    const rows = await sql`
      WITH inserted_campaign AS (
        INSERT INTO campaigns (
          id, name, subject, preview_text, heading, content,
          cta_label, cta_url, status, created_by, created_at, updated_at
        )
        VALUES (
          ${campaignId}, ${value.name}, ${value.subject},
          ${value.previewText || null}, ${value.heading}, ${value.content},
          ${value.ctaLabel || null}, ${value.ctaUrl || null},
          'draft', 'admin', NOW(), NOW()
        )
        RETURNING id
      ),
      recipients AS (
        INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, email, name, status, created_at, updated_at
        )
        SELECT
          gen_random_uuid(), ${campaignId}, id, email, name, 'queued', NOW(), NOW()
        FROM marketing_eligible_contacts
        RETURNING id
      )
      UPDATE campaigns
      SET audience_count = (SELECT COUNT(*) FROM recipients),
          updated_at = NOW()
      WHERE id = ${campaignId}
      RETURNING id, audience_count
    `;

    return NextResponse.json({
      id: campaignId,
      audienceCount: Number(rows[0]?.audience_count || 0),
    });
  } catch (error) {
    console.error("Campaign creation failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Kampanya oluşturulamadı." },
      { status: 503 },
    );
  }
}

