import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated, isSameOrigin } from "@/lib/admin-auth";
import {
  claimCampaignWorker,
  refreshCampaignCounts,
} from "@/lib/campaign-worker";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { startCampaignDelivery } from "@/lib/start-campaign-workflow";

export const runtime = "nodejs";
export const maxDuration = 60;

const actionSchema = z.object({
  action: z.enum(["send", "pause", "resume", "cancel"]),
});

async function campaignState(id: string) {
  const sql = db();
  const counts = await refreshCampaignCounts(id);
  const quotaRows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM campaign_recipients
      WHERE campaign_id = ${id}
        AND status = 'queued'
        AND error_message ILIKE '%Daily message quota exceeded%'
    ) AS quota_waiting
  `;
  return {
    ...counts,
    quota_waiting: Boolean(quotaRows[0]?.quota_waiting),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    await ensureDatabaseSchema();
    const { id } = await params;
    return NextResponse.json(await campaignState(id), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Campaign state failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Gönderim durumu alınamadı." },
      { status: 503 },
    );
  }
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
    const action = parsed.data.action;

    if (action === "pause") {
      await sql`
        UPDATE campaigns
        SET status = 'paused', worker_token = NULL, worker_lease_until = NULL,
            updated_at = NOW()
        WHERE id = ${id} AND status = 'sending'
      `;
    } else if (action === "cancel") {
      await sql`
        UPDATE campaigns
        SET status = 'cancelled', worker_token = NULL, worker_lease_until = NULL,
            updated_at = NOW()
        WHERE id = ${id} AND status IN ('draft', 'sending', 'paused')
      `;
    } else {
      await sql`
        UPDATE campaign_recipients
        SET status = 'queued',
            attempt_count = 0,
            claimed_at = NULL,
            error_message = 'SES kotası açıldığında yeniden denenecek.',
            updated_at = NOW()
        WHERE campaign_id = ${id}
          AND status = 'failed'
          AND error_message ILIKE '%Daily message quota exceeded%'
      `;
      await sql`
        UPDATE campaigns
        SET status = 'sending',
            started_at = COALESCE(started_at, NOW()),
            worker_token = NULL,
            worker_lease_until = NULL,
            updated_at = NOW()
        WHERE id = ${id} AND status IN ('draft', 'sending', 'paused')
      `;
      const token = await claimCampaignWorker(id);
      if (token) {
        await startCampaignDelivery(id, token);
      }
    }

    return NextResponse.json(await campaignState(id));
  } catch (error) {
    console.error("Campaign action failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Gönderim işlemi gerçekleştirilemedi." },
      { status: 503 },
    );
  }
}
