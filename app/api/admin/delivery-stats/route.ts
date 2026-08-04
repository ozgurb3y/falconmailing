import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { claimCampaignWorker } from "@/lib/campaign-worker";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { getLiveSesQuota } from "@/lib/ses-quota";
import { startCampaignDelivery } from "@/lib/start-campaign-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }

    await ensureDatabaseSchema();
    const sql = db();
    const [rows, liveQuota] = await Promise.all([sql`
      WITH latest_campaign AS (
        SELECT
          id,
          subject,
          status,
          audience_count,
          sent_count,
          failed_count,
          skipped_count,
          updated_at
        FROM campaigns
        ORDER BY (status = 'sending') DESC, created_at DESC
        LIMIT 1
      ),
      monthly_delivery AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent')::int AS accepted,
          COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered
        FROM campaign_recipients
        WHERE sent_at >= date_trunc('month', NOW())
          AND sent_at < date_trunc('month', NOW()) + INTERVAL '1 month'
      ),
      rolling_quota AS (
        SELECT
          COUNT(*) FILTER (
            WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL '24 hours'
          )::int AS sent_last_24_hours,
          EXISTS (
            SELECT 1 FROM campaign_recipients
            WHERE status = 'queued'
              AND error_message ILIKE '%Daily message quota exceeded%'
          ) AS quota_exhausted
        FROM campaign_recipients
      ),
      latest_delivery AS (
        SELECT
          COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered,
          COUNT(*) FILTER (WHERE delivery_status = 'bounced')::int AS bounced,
          COUNT(*) FILTER (WHERE delivery_status = 'complained')::int AS complained,
          COUNT(*) FILTER (WHERE delivery_status = 'delayed')::int AS delayed,
          COUNT(*) FILTER (
            WHERE delivery_status IN ('rejected', 'rendering_failed')
          )::int AS rejected
        FROM campaign_recipients
        WHERE campaign_id = (SELECT id FROM latest_campaign)
      )
      SELECT
        latest_campaign.id,
        latest_campaign.subject,
        latest_campaign.status,
        COALESCE(latest_campaign.audience_count, 0)::int AS requested,
        COALESCE(latest_campaign.sent_count, 0)::int AS sent,
        COALESCE(latest_campaign.failed_count, 0)::int AS failed,
        COALESCE(latest_campaign.skipped_count, 0)::int AS skipped,
        latest_delivery.delivered::int AS delivered,
        latest_delivery.bounced::int AS bounced,
        latest_delivery.complained::int AS complained,
        latest_delivery.delayed::int AS delayed,
        latest_delivery.rejected::int AS rejected,
        latest_campaign.updated_at,
        monthly_delivery.accepted::int AS monthly_sent,
        monthly_delivery.delivered::int AS monthly_delivered,
        rolling_quota.sent_last_24_hours::int,
        rolling_quota.quota_exhausted
      FROM monthly_delivery, latest_delivery, rolling_quota
      LEFT JOIN latest_campaign ON TRUE
    `, getLiveSesQuota()]);
    const row = rows[0];
    if (row?.id && row.status === "sending") {
      const token = await claimCampaignWorker(String(row.id));
      if (token) {
        await startCampaignDelivery(String(row.id), token);
      }
    }
    const requested = Number(row?.requested || 0);
    const sent = Number(row?.sent || 0);
    const configuredQuota = Math.max(
      1,
      Number(process.env.SES_DAILY_QUOTA || 10_000),
    );
    const databaseSentLast24Hours = Number(row?.sent_last_24_hours || 0);
    const estimatedQuota = Math.max(configuredQuota, databaseSentLast24Hours);
    const quotaMax = liveQuota?.max24HourSend ?? estimatedQuota;
    const quotaSent = liveQuota?.sentLast24Hours ?? databaseSentLast24Hours;
    const quotaRemaining =
      quotaMax < 0 ? -1 : Math.max(0, quotaMax - quotaSent);
    return NextResponse.json(
      {
        campaignId: row?.id || null,
        subject: row?.subject || null,
        status: row?.status || "idle",
        requested,
        sent,
        delivered: Number(row?.delivered || 0),
        bounced: Number(row?.bounced || 0),
        complained: Number(row?.complained || 0),
        delayed: Number(row?.delayed || 0),
        rejected: Number(row?.rejected || 0),
        failed: Number(row?.failed || 0),
        skipped: Number(row?.skipped || 0),
        monthlySent: Number(row?.monthly_sent || 0),
        monthlyDelivered: Number(row?.monthly_delivered || 0),
        quotaMax,
        quotaSent,
        quotaRemaining,
        quotaMaxSendRate: liveQuota?.maxSendRate ?? null,
        quotaSource: liveQuota
          ? "aws"
          : databaseSentLast24Hours > configuredQuota || row?.quota_exhausted
            ? "estimated"
            : "configured",
        updatedAt: row?.updated_at || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Delivery stats failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Gönderim istatistikleri alınamadı." },
      { status: 503 },
    );
  }
}
