import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const body = await request.text();

    if (
      !body.includes("List-Unsubscribe=One-Click") ||
      !(await unsubscribeByToken(token))
    ) {
      return new NextResponse(null, { status: 400 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

