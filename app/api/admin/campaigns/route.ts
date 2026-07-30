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

const recipientSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(100).optional().nullable(),
});

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
    internalRecipients: z.array(recipientSchema).optional().default([]),
    internalAuthorized: z.boolean().optional().default(false),
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
    if (
      value.audienceType === "internal" &&
      value.internalRecipients.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["internalRecipients"],
        message: "En az bir geçerli e-posta adresi girilmelidir.",
      });
    }
    if (value.audienceType === "internal" && !value.internalAuthorized) {
      context.addIssue({
        code: "custom",
        path: ["internalAuthorized"],
        message: "Gönderim yetkisi beyanı gereklidir.",
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
    const internalRecipients = Array.from(
      new Map(
        value.internalRecipients.map((recipient) => [
          recipient.email.toLowerCase(),
          {
            email: recipient.email.toLowerCase(),
            name: recipient.name || null,
          },
        ]),
      ).values(),
    );
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
          id AS contact_id,
          NULL::uuid AS internal_recipient_id,
          email,
          name
        FROM marketing_eligible_contacts
        WHERE ${value.audienceType} = 'marketing'
        UNION ALL
        SELECT
          NULL::uuid AS contact_id,
          NULL::uuid AS internal_recipient_id,
          lower(trim(input.email)) AS email,
          nullif(trim(input.name), '') AS name
        FROM jsonb_to_recordset(${JSON.stringify(internalRecipients)}::jsonb)
          AS input(email TEXT, name TEXT)
        WHERE ${value.audienceType} = 'internal'
          AND NOT EXISTS (
            SELECT 1
            FROM email_suppressions blocked
            WHERE lower(blocked.email) = lower(trim(input.email))
          )
      ),
      recipients AS (
        INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, internal_recipient_id,
          email, name, status, created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          ${campaignId},
          contact_id,
          internal_recipient_id,
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
