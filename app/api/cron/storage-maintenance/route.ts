import { NextResponse } from "next/server";
import { cleanupCompletedCampaignData } from "@/lib/storage-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  try {
    const result = await cleanupCompletedCampaignData();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Scheduled storage cleanup failed", error);
    return NextResponse.json(
      { error: "Veritabanı temizliği tamamlanamadı." },
      { status: 500 },
    );
  }
}
