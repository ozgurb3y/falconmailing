import { after, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { claimCampaignWorker, runCampaignWorker } from "@/lib/campaign-worker";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }

    await ensureDatabaseSchema();
    const sql = db();
    const rows = await sql`
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
        SELECT COUNT(*)::int AS sent
        FROM campaign_recipients
        WHERE status = 'sent'
          AND sent_at >= date_trunc('month', NOW())
          AND sent_at < date_trunc('month', NOW()) + INTERVAL '1 month'
      )
      SELECT
        latest_campaign.id,
        latest_campaign.subject,
        latest_campaign.status,
        COALESCE(latest_campaign.audience_count, 0)::int AS requested,
        COALESCE(latest_campaign.sent_count, 0)::int AS sent,
        COALESCE(latest_campaign.failed_count, 0)::int AS failed,
        COALESCE(latest_campaign.skipped_count, 0)::int AS skipped,
        latest_campaign.updated_at,
        monthly_delivery.sent::int AS monthly_sent
      FROM monthly_delivery
      LEFT JOIN latest_campaign ON TRUE
    `;
    const row = rows[0];
    if (row?.id && row.status === "sending") {
      const token = await claimCampaignWorker(String(row.id));
      if (token) {
        after(async () => {
          try {
            await runCampaignWorker(String(row.id), token);
          } catch (error) {
            console.error("Campaign recovery worker failed", {
              campaignId: String(row.id),
              message: error instanceof Error ? error.message : "unknown",
            });
          }
        });
      }
    }
    const requested = Number(row?.requested || 0);
    const sent = Number(row?.sent || 0);
    const fullyDelivered = requested > 0 && sent >= requested;

    return NextResponse.json(
      {
        campaignId: fullyDelivered ? null : row?.id || null,
        subject: fullyDelivered ? null : row?.subject || null,
        status: fullyDelivered ? "idle" : row?.status || "idle",
        requested: fullyDelivered ? 0 : requested,
        sent: fullyDelivered ? 0 : sent,
        failed: fullyDelivered ? 0 : Number(row?.failed || 0),
        skipped: fullyDelivered ? 0 : Number(row?.skipped || 0),
        monthlySent: Number(row?.monthly_sent || 0),
        updatedAt: fullyDelivered ? null : row?.updated_at || null,
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
