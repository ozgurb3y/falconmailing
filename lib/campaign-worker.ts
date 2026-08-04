import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sendCampaignEmail } from "@/lib/campaign-mail";
import { db } from "@/lib/db";
import { createToken, hashToken } from "@/lib/security";
import { reconcileSesMessage } from "@/lib/ses-events";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_BATCHES_PER_INVOCATION = 3;
const DEFAULT_SEND_RATE_PER_SECOND = 14;

type Recipient = {
  id: string;
  contact_id: string | null;
  internal_recipient_id: string | null;
  email: string;
  name: string | null;
  send_order: number;
  attempt_count: number;
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
  content_mode: "template" | "html";
  html_content: string | null;
};

function positiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function workerSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is not configured securely.");
  }
  return secret;
}

function workerSignature(campaignId: string, token: string) {
  return createHmac("sha256", workerSecret())
    .update(`${campaignId}.${token}`)
    .digest("base64url");
}

export function verifyWorkerAuthorization(
  campaignId: string,
  token: string,
  suppliedSignature: string | null,
) {
  if (!suppliedSignature) return false;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(workerSignature(campaignId, token));
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function refreshCampaignCounts(campaignId: string) {
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
      worker_token = CASE
        WHEN campaigns.status = 'sending' AND counts.remaining = 0 THEN NULL
        ELSE campaigns.worker_token
      END,
      worker_lease_until = CASE
        WHEN campaigns.status = 'sending' AND counts.remaining = 0 THEN NULL
        ELSE campaigns.worker_lease_until
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

export async function claimCampaignWorker(campaignId: string) {
  const sql = db();
  const token = randomUUID();
  const rows = await sql`
    UPDATE campaigns
    SET worker_token = ${token},
        worker_lease_until = NOW() + INTERVAL '2 minutes',
        updated_at = NOW()
    WHERE id = ${campaignId}
      AND status = 'sending'
      AND (worker_lease_until IS NULL OR worker_lease_until < NOW())
    RETURNING worker_token
  `;
  return rows[0] ? token : null;
}

function transientDeliveryError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details = error as Error & { responseCode?: number; code?: string };
  return (
    (typeof details.responseCode === "number" && details.responseCode >= 400 && details.responseCode < 500) ||
    ["ECONNECTION", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(details.code || "")
  );
}

function deliveryErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Bilinmeyen gönderim hatası";
}

function dailyDeliveryQuotaExceeded(error: unknown) {
  return (
    error instanceof Error &&
    /daily message quota exceeded/i.test(error.message)
  );
}

function deliveryRateExceeded(error: unknown) {
  return (
    error instanceof Error &&
    /maximum sending rate exceeded|throttling failure/i.test(error.message)
  );
}

async function processRecipient(campaign: Campaign, recipient: Recipient) {
  const sql = db();
  const eligible = recipient.contact_id
    ? await sql`
        SELECT id FROM marketing_eligible_contacts
        WHERE id = ${recipient.contact_id} LIMIT 1
      `
    : recipient.internal_recipient_id
      ? await sql`
          SELECT id FROM internal_recipients
          WHERE id = ${recipient.internal_recipient_id} AND status = 'active'
          LIMIT 1
        `
      : await sql`
          SELECT 1 WHERE NOT EXISTS (
            SELECT 1 FROM email_suppressions
            WHERE lower(email) = lower(${recipient.email})
          )
        `;

  if (eligible.length === 0) {
    await sql`
      UPDATE campaign_recipients
      SET status = 'skipped',
          error_message = 'Alıcı gönderim sırasında uygun değildi.',
          updated_at = NOW()
      WHERE id = ${recipient.id} AND status = 'processing'
    `;
    return "processed" as const;
  }

  const unsubscribeToken = createToken();
  try {
    await sql`
      INSERT INTO unsubscribe_tokens (
        token_hash, contact_id, internal_recipient_id,
        recipient_email, campaign_id, created_at
      ) VALUES (
        ${hashToken(unsubscribeToken)},
        ${recipient.contact_id || null},
        ${recipient.internal_recipient_id || null},
        ${recipient.contact_id || recipient.internal_recipient_id ? null : recipient.email},
        ${campaign.id}, NOW()
      )
    `;
    const message = await sendCampaignEmail({
      to: recipient.email,
      recipientName: recipient.name,
      subject: campaign.subject,
      previewText: campaign.preview_text,
      heading: campaign.heading,
      content: campaign.content,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      contentMode: campaign.content_mode,
      htmlContent: campaign.html_content,
      unsubscribeToken,
      audienceType: campaign.audience_type,
    });
    await sql`
      UPDATE campaign_recipients
      SET status = 'sent', sent_at = NOW(),
          rfc_message_id = ${message.rfcMessageId},
          ses_message_id = ${message.sesMessageId},
          delivery_status = 'accepted',
          last_delivery_event_at = NOW(),
          error_message = NULL, updated_at = NOW()
      WHERE id = ${recipient.id} AND status = 'processing'
    `;
    if (message.sesMessageId) {
      await reconcileSesMessage(message.sesMessageId);
    }
    return "processed" as const;
  } catch (error) {
    if (dailyDeliveryQuotaExceeded(error) || deliveryRateExceeded(error)) {
      await sql`
        UPDATE campaign_recipients
        SET status = 'queued', claimed_at = NULL,
            attempt_count = GREATEST(attempt_count - 1, 0),
            error_message = ${deliveryErrorMessage(error)},
            updated_at = NOW()
        WHERE id = ${recipient.id} AND status = 'processing'
      `;
      return dailyDeliveryQuotaExceeded(error)
        ? ("quota_deferred" as const)
        : ("rate_deferred" as const);
    }
    const retry = transientDeliveryError(error) && recipient.attempt_count < 3;
    await sql`
      UPDATE campaign_recipients
      SET status = ${retry ? "queued" : "failed"},
          claimed_at = CASE WHEN ${retry} THEN NULL ELSE claimed_at END,
          error_message = ${deliveryErrorMessage(error)},
          updated_at = NOW()
      WHERE id = ${recipient.id} AND status = 'processing'
    `;
    return "processed" as const;
  }
}

export async function processCampaignBatch(campaignId: string, token: string) {
  const sql = db();
  const campaignRows = await sql`
    UPDATE campaigns
    SET worker_lease_until = NOW() + INTERVAL '2 minutes', updated_at = NOW()
    WHERE id = ${campaignId} AND status = 'sending' AND worker_token = ${token}
    RETURNING id, subject, preview_text, heading, content, cta_label, cta_url,
              audience_type, content_mode, html_content
  `;
  const campaign = campaignRows[0] as Campaign | undefined;
  if (!campaign) return { active: false, remaining: 0, progressed: false };

  await sql`
    UPDATE campaign_recipients
    SET status = 'queued', claimed_at = NULL, updated_at = NOW()
    WHERE campaign_id = ${campaignId} AND status = 'processing'
      AND claimed_at < NOW() - INTERVAL '2 minutes'
  `;
  const batchSize = positiveInteger(
    process.env.CAMPAIGN_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    100,
  );
  const claimedRows = await sql`
    WITH selected AS (
      SELECT id FROM campaign_recipients
      WHERE campaign_id = ${campaignId} AND status = 'queued'
      ORDER BY send_order
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE campaign_recipients r
    SET status = 'processing', claimed_at = NOW(),
        attempt_count = attempt_count + 1, updated_at = NOW()
    FROM selected
    WHERE r.id = selected.id
    RETURNING r.id, r.contact_id, r.internal_recipient_id, r.email, r.name,
              r.send_order, r.attempt_count
  `;

  const recipients = (claimedRows as Recipient[]).sort(
    (left, right) => left.send_order - right.send_order,
  );
  const sendRate = positiveInteger(
    process.env.CAMPAIGN_SEND_RATE_PER_SECOND,
    DEFAULT_SEND_RATE_PER_SECOND,
    50,
  );
  let quotaDeferred = false;
  let rateDeferred = false;
  for (let index = 0; index < recipients.length; index += sendRate) {
    const group = recipients.slice(index, index + sendRate);
    const groupStartedAt = Date.now();
    const results = await Promise.all(
      group.map(async (recipient) => {
        try {
          return await processRecipient(campaign, recipient);
        } catch (error) {
          console.error("Campaign recipient processing failed", {
            campaignId,
            recipient: recipient.email,
            message: error instanceof Error ? error.message : "unknown",
          });
          const retry = recipient.attempt_count < 3;
          await sql`
            UPDATE campaign_recipients
            SET status = ${retry ? "queued" : "failed"},
                claimed_at = NULL,
                error_message = ${deliveryErrorMessage(error)},
                updated_at = NOW()
            WHERE id = ${recipient.id} AND status = 'processing'
          `;
          return "processed" as const;
        }
      }),
    );
    quotaDeferred = results.includes("quota_deferred");
    rateDeferred = results.includes("rate_deferred");
    if (quotaDeferred || rateDeferred) {
      const groupLastOrder = group.at(-1)?.send_order;
      const batchLastOrder = recipients.at(-1)?.send_order;
      if (groupLastOrder && batchLastOrder && groupLastOrder < batchLastOrder) {
        await sql`
          UPDATE campaign_recipients
          SET status = 'queued', claimed_at = NULL,
              attempt_count = GREATEST(attempt_count - 1, 0),
              updated_at = NOW()
          WHERE campaign_id = ${campaignId}
            AND status = 'processing'
            AND send_order > ${groupLastOrder}
            AND send_order <= ${batchLastOrder}
        `;
      }
      break;
    }
    if (index + sendRate < recipients.length) {
      const remainingWindowMs = 1_000 - (Date.now() - groupStartedAt);
      if (remainingWindowMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingWindowMs));
      }
    }
  }
  const counts = await refreshCampaignCounts(campaignId);
  return {
    active: counts?.status === "sending",
    remaining: Number(counts?.remaining || 0),
    progressed: claimedRows.length > 0 && !quotaDeferred && !rateDeferred,
    quotaDeferred,
    rateDeferred,
  };
}

async function continueInNewInvocation(campaignId: string, token: string) {
  const appUrl = process.env.APP_URL || "https://falconmailing.com";
  const response = await fetch(`${appUrl}/api/internal/campaign-worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-campaign-worker-signature": workerSignature(campaignId, token),
    },
    body: JSON.stringify({ campaignId, token }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Campaign worker continuation failed (${response.status}).`);
  }
}

export async function runCampaignWorker(campaignId: string, token: string) {
  const batchLimit = positiveInteger(
    process.env.CAMPAIGN_BATCHES_PER_INVOCATION,
    DEFAULT_BATCHES_PER_INVOCATION,
    20,
  );
  let result = { active: true, remaining: 1, progressed: true };
  for (
    let index = 0;
    index < batchLimit && result.active && result.remaining > 0 && result.progressed;
    index += 1
  ) {
    result = await processCampaignBatch(campaignId, token);
  }
  if (result.active && result.remaining > 0 && result.progressed) {
    await continueInNewInvocation(campaignId, token);
  }
}
