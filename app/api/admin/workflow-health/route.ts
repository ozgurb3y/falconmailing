import { NextResponse } from "next/server";
import { getWorld, healthCheck } from "workflow/runtime";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  const world = await getWorld();
  const [workflow, step] = await Promise.all([
    healthCheck(world, "workflow", { timeout: 25_000 }),
    healthCheck(world, "step", { timeout: 25_000 }),
  ]);

  const healthy = workflow.healthy && step.healthy;
  return NextResponse.json(
    { healthy, workflow, step },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
