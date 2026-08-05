import { NextResponse } from "next/server";
import { z } from "zod";
import { unsubscribeByToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(32).max(1024),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !(await unsubscribeByToken(parsed.data.token))) {
      return NextResponse.json(
        { message: "Abonelikten çıkma bağlantısı geçersiz veya süresi dolmuş." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unsubscribe failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin." },
      { status: 503 },
    );
  }
}
