import { NextResponse } from "next/server";
import { isAdminAuthenticated, isSameOrigin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminAuthenticated()) || !isSameOrigin(request)) {
      return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
    }
    const { id } = await params;
    const sql = db();
    const rows = await sql`
      DELETE FROM campaigns
      WHERE id = ${id} AND status = 'draft'
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Silinebilecek taslak kampanya bulunamadı." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Draft campaign cleanup failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "Eksik kampanya temizlenemedi." },
      { status: 503 },
    );
  }
}
