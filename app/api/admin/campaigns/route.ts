import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isSameOrigin,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import {
  campaignHtmlToText,
  sanitizeCampaignHtml,
} from "@/lib/campaign-html";

export const runtime = "nodejs";

const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    subject: z.string().trim().min(3).max(180),
    previewText: z.string().trim().max(220).optional().nullable(),
    contentMode: z.enum(["template", "html"]),
    heading: z.string().trim().max(180).optional().nullable(),
    content: z.string().trim().max(20_000).optional().nullable(),
    htmlContent: z.string().trim().max(500_000).optional().nullable(),
    audienceType: z.enum(["marketing", "internal"]),
    ctaLabel: z.string().trim().max(80).optional().nullable(),
    ctaUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  })
  .refine(
    (value) =>
      (!value.ctaLabel && !value.ctaUrl) ||
      Boolean(value.ctaLabel && value.ctaUrl),
    { message: "Buton metni ve bağlantısı birlikte girilmelidir." },
  )
  .superRefine((value, context) => {
    if (
      value.contentMode === "template" &&
      (!value.heading || value.heading.length < 3)
    ) {
      context.addIssue({
        code: "custom",
        path: ["heading"],
        message: "E-posta başlığı en az 3 karakter olmalıdır.",
      });
    }
    if (
      value.contentMode === "template" &&
      (!value.content || value.content.length < 10)
    ) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: "İçerik en az 10 karakter olmalıdır.",
      });
    }
    if (
      value.contentMode === "html" &&
      (!value.htmlContent || value.htmlContent.length < 10)
    ) {
      context.addIssue({
        code: "custom",
        path: ["htmlContent"],
        message: "HTML içeriği en az 10 karakter olmalıdır.",
      });
    }
  });

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
    const sanitizedHtml =
      value.contentMode === "html"
        ? sanitizeCampaignHtml(value.htmlContent || "")
        : null;
    if (
      value.contentMode === "html" &&
      campaignHtmlToText(sanitizedHtml || "").length < 3
    ) {
      return NextResponse.json(
        { message: "HTML içeriği temizlendikten sonra boş kaldı." },
        { status: 400 },
      );
    }
    const heading = value.heading || value.subject;
    const content =
      value.contentMode === "html"
        ? campaignHtmlToText(sanitizedHtml || "") || value.subject
        : value.content || value.subject;
    await sql`
      INSERT INTO campaigns (
        id, name, subject, preview_text, heading, content,
        cta_label, cta_url, audience_type, content_mode, html_content, status,
        created_by, created_at, updated_at
      )
      VALUES (
        ${campaignId}, ${value.name}, ${value.subject},
        ${value.previewText || null}, ${heading}, ${content},
        ${value.contentMode === "template" ? value.ctaLabel || null : null},
        ${value.contentMode === "template" ? value.ctaUrl || null : null},
        ${value.audienceType}, ${value.contentMode}, ${sanitizedHtml}, 'draft',
        'admin', NOW(), NOW()
      )
    `;
    const rows = await sql`
      WITH source_recipients AS (
        SELECT
          id,
          email,
          name,
          'marketing'::text AS source
        FROM marketing_eligible_contacts
        WHERE ${value.audienceType} = 'marketing'
        UNION ALL
        SELECT
          id,
          email,
          name,
          'internal'::text AS source
        FROM internal_recipients
        WHERE ${value.audienceType} = 'internal'
          AND status = 'active'
      ),
      recipients AS (
        INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, internal_recipient_id,
          email, name, status, created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          ${campaignId},
          CASE WHEN source = 'marketing' THEN id ELSE NULL END,
          CASE WHEN source = 'internal' THEN id ELSE NULL END,
          email,
          name,
          'queued',
          NOW(),
          NOW()
        FROM source_recipients
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
