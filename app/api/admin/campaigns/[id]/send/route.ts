import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isSameOrigin,
} from "@/lib/admin-auth";
import { sendCampaignEmail } from "@/lib/campaign-mail";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { createToken, hashToken } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const actionSchema = z.object({
  action: z.enum(["send", "pause", "resume", "cancel"]),
});

type Recipient = {
  id: string;
  contact_id: string | null;
  internal_recipient_id: string | null;
  email: string;
  name: string | null;
};

type Campaign = {
  id: string;
  subject: string;
  preview_text: string | null;
  heading: string;
  content: string;
  cta_label: string | null;
  cta_url: string | null;
  audience_type: "marketing" | "internal";
  status: string;
};

async function refreshCounts(campaignId: string) {
  const sql = db();
  const rows = await sql`
    WITH counts AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
        COUNT(*) FILTER (WHERE status IN ('queued', 'processing'))::int AS remaining
      FROM campaign_recipients
      WHERE campaign_id = ${campaignId}
    )
    UPDATE campaigns
    SET
      sent_count = counts.sent,
      failed_count = counts.failed,
      skipped_count = counts.skipped,
      status = CASE
        WHEN campaigns.status = 'sending' AND counts.remaining = 0 THEN 'completed'
        ELSE campaigns.status
      END,
      completed_at = CASE
        WHEN campaigns.status = 'sending' AND counts.remaining = 0
          THEN COALESCE(campaigns.completed_at, NOW())
        ELSE campaigns.completed_at
      END,
      updated_at = NOW()
    FROM counts
    WHERE campaigns.id = ${campaignId}
    RETURNING
      campaigns.status,
      campaigns.sent_count,
      campaigns.failed_count,
      campaigns.skipped_count,
      counts.remaining
  `;
  return rows[0];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    const { id } = await params;
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Geçersiz işlem." }, { status: 400 });
    }

    await ensureDatabaseSchema();
    const sql = db();

    if (parsed.data.action !== "send") {
      if (parsed.data.action === "pause") {
        await sql`
          UPDATE campaigns
          SET status = 'paused', updated_at = NOW()
          WHERE id = ${id} AND status = 'sending'
        `;
      } else if (parsed.data.action === "resume") {
        await sql`
          UPDATE campaigns
          SET status = 'sending', updated_at = NOW()
          WHERE id = ${id} AND status = 'paused'
        `;
      } else {
        await sql`
          UPDATE campaigns
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = ${id} AND status IN ('draft', 'sending', 'paused')
        `;
      }
      return NextResponse.json(await refreshCounts(id));
    }

    const campaignRows = await sql`
      UPDATE campaigns
      SET
        status = CASE WHEN status = 'draft' THEN 'sending' ELSE status END,
        started_at = CASE
          WHEN status = 'draft' THEN COALESCE(started_at, NOW())
          ELSE started_at
        END,
        updated_at = NOW()
      WHERE id = ${id}
        AND status IN ('draft', 'sending')
      RETURNING *
    `;
    const campaign = campaignRows[0] as Campaign | undefined;
    if (!campaign) {
      return NextResponse.json(await refreshCounts(id));
    }

    await sql`
      UPDATE campaign_recipients
      SET status = 'queued', claimed_at = NULL, updated_at = NOW()
      WHERE campaign_id = ${id}
        AND status = 'processing'
        AND claimed_at < NOW() - INTERVAL '15 minutes'
    `;

    const claimedRows = await sql`
      WITH selected AS (
        SELECT id
        FROM campaign_recipients
        WHERE campaign_id = ${id}
          AND status = 'queued'
        ORDER BY created_at
        LIMIT 8
        FOR UPDATE SKIP LOCKED
      )
      UPDATE campaign_recipients r
      SET
        status = 'processing',
        claimed_at = NOW(),
        attempt_count = attempt_count + 1,
        updated_at = NOW()
      FROM selected
      WHERE r.id = selected.id
      RETURNING
        r.id, r.contact_id, r.internal_recipient_id, r.email, r.name
    `;

    for (const recipient of claimedRows as Recipient[]) {
      const eligible = recipient.contact_id
        ? await sql`
            SELECT id
            FROM marketing_eligible_contacts
            WHERE id = ${recipient.contact_id}
            LIMIT 1
          `
        : await sql`
            SELECT id
            FROM internal_recipients
            WHERE id = ${recipient.internal_recipient_id}
              AND status = 'active'
            LIMIT 1
          `;
      if (eligible.length === 0) {
        await sql`
          UPDATE campaign_recipients
          SET status = 'skipped',
              error_message = 'Alıcı gönderim sırasında uygun değildi.',
              updated_at = NOW()
          WHERE id = ${recipient.id}
        `;
        continue;
      }

      const unsubscribeToken = createToken();
      try {
        await sql`
          INSERT INTO unsubscribe_tokens (
            token_hash, contact_id, internal_recipient_id,
            campaign_id, created_at
          )
          VALUES (
            ${hashToken(unsubscribeToken)},
            ${recipient.contact_id || null},
            ${recipient.internal_recipient_id || null},
            ${id},
            NOW()
          )
        `;
        const messageId = await sendCampaignEmail({
          to: recipient.email,
          recipientName: recipient.name,
          subject: campaign.subject,
          previewText: campaign.preview_text,
          heading: campaign.heading,
          content: campaign.content,
          ctaLabel: campaign.cta_label,
          ctaUrl: campaign.cta_url,
          unsubscribeToken,
          audienceType: campaign.audience_type,
        });
        await sql`
          UPDATE campaign_recipients
          SET
            status = 'sent',
            sent_at = NOW(),
            ses_message_id = ${messageId},
            error_message = NULL,
            updated_at = NOW()
          WHERE id = ${recipient.id}
        `;
      } catch (error) {
        await sql`
          UPDATE campaign_recipients
          SET
            status = 'failed',
            error_message = ${
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Bilinmeyen gönderim hatası"
            },
            updated_at = NOW()
          WHERE id = ${recipient.id}
        `;
      }
    }

    const result = await refreshCounts(id);
    await sql`
      INSERT INTO audit_logs (id, action, actor, metadata, created_at)
      VALUES (
        ${randomUUID()},
        'campaign_batch_processed',
        'admin',
        ${JSON.stringify({ campaignId: id, batchSize: claimedRows.length })}::jsonb,
        NOW()
      )
    `;
    return NextResponse.json(result);
  } catch (error) {
    console.error("Campaign batch failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Gönderim grubu işlenemedi." },
      { status: 503 },
    );
  }
}
