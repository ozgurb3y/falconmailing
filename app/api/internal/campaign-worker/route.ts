import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  runCampaignWorker,
  verifyWorkerAuthorization,
} from "@/lib/campaign-worker";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  campaignId: z.string().uuid(),
  token: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    !verifyWorkerAuthorization(
      parsed.data.campaignId,
      parsed.data.token,
      request.headers.get("x-campaign-worker-signature"),
    )
  ) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  await ensureDatabaseSchema();
  after(async () => {
    try {
      await runCampaignWorker(parsed.data.campaignId, parsed.data.token);
    } catch (error) {
      console.error("Campaign worker failed", {
        campaignId: parsed.data.campaignId,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
