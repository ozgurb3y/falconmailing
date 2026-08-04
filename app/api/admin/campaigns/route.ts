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
export const maxDuration = 300;

const RECIPIENT_INSERT_CHUNK_SIZE = 5_000;
const RECIPIENT_INSERT_CONCURRENCY = 4;

const emailAddressSchema = z.string().trim().email().max(254);

const recipientSchema = z.object({
  email: z.string().trim().min(1).max(10_000),
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
        message: "En az bir e-posta kaydı girilmelidir.",
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
          { email: recipient.email, name: recipient.name || null },
        ]),
      ).values(),
    ).map((recipient, index) => ({
      ...recipient,
      sendOrder: index + 1,
      isValid: emailAddressSchema.safeParse(recipient.email).success,
    }));
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
    let audienceCount = 0;
    let failedCount = 0;
    try {
      if (value.audienceType === "marketing") {
        const inserted = await sql`
          INSERT INTO campaign_recipients (
            id, campaign_id, contact_id, internal_recipient_id,
            email, name, send_order, status, created_at, updated_at
          )
          SELECT
            gen_random_uuid(), ${campaignId}, id, NULL, email, name,
            ROW_NUMBER() OVER (ORDER BY lower(email))::int,
            'queued', NOW(), NOW()
          FROM marketing_eligible_contacts
          RETURNING status
        `;
        audienceCount = inserted.length;
      } else {
        for (
          let groupStart = 0;
          groupStart < internalRecipients.length;
          groupStart += RECIPIENT_INSERT_CHUNK_SIZE * RECIPIENT_INSERT_CONCURRENCY
        ) {
          const chunks = Array.from(
            { length: RECIPIENT_INSERT_CONCURRENCY },
            (_, chunkIndex) => {
              const start =
                groupStart + chunkIndex * RECIPIENT_INSERT_CHUNK_SIZE;
              return internalRecipients.slice(
                start,
                start + RECIPIENT_INSERT_CHUNK_SIZE,
              );
            },
          ).filter((chunk) => chunk.length > 0);

          const insertedGroups = await Promise.all(
            chunks.map((chunk) => sql`
              INSERT INTO campaign_recipients (
                id, campaign_id, contact_id, internal_recipient_id,
                email, name, send_order, status, error_message,
                created_at, updated_at
              )
              SELECT
                gen_random_uuid(), ${campaignId}, NULL, NULL,
                lower(trim(input.email)), nullif(trim(input.name), ''),
                input."sendOrder",
                CASE WHEN input."isValid" THEN 'queued' ELSE 'failed' END,
                CASE
                  WHEN input."isValid" THEN NULL
                  ELSE 'Geçersiz e-posta adresi; gönderim yapılmadı.'
                END,
                NOW(), NOW()
              FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
                AS input(
                  email TEXT, name TEXT, "sendOrder" INTEGER, "isValid" BOOLEAN
                )
              RETURNING status
            `),
          );

          for (const inserted of insertedGroups) {
            audienceCount += inserted.length;
            failedCount += inserted.filter(
              (recipient) => recipient.status === "failed",
            ).length;
          }
        }
      }

      await sql`
        UPDATE campaigns
        SET audience_count = ${audienceCount},
            failed_count = ${failedCount},
            updated_at = NOW()
        WHERE id = ${campaignId}
      `;
    } catch (recipientError) {
      await sql`DELETE FROM campaigns WHERE id = ${campaignId}`.catch(
        (cleanupError) => {
          console.error("Incomplete campaign cleanup failed", {
            campaignId,
            message:
              cleanupError instanceof Error ? cleanupError.message : "unknown",
          });
        },
      );
      throw recipientError;
    }

    return NextResponse.json({
      id: campaignId,
      audienceCount,
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
