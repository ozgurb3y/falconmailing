import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CampaignErrorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }
  const sql = db();
  const rows = await sql`
    SELECT
      status,
      COALESCE(NULLIF(error_message, ''), 'Açıklama bulunmuyor') AS error_message,
      COUNT(*)::int AS error_count,
      MIN(send_order)::int AS first_order,
      MAX(send_order)::int AS last_order,
      MAX(attempt_count)::int AS max_attempts
    FROM campaign_recipients
    WHERE campaign_id = ${id}
      AND status IN ('failed', 'skipped')
    GROUP BY status, COALESCE(NULLIF(error_message, ''), 'Açıklama bulunmuyor')
    ORDER BY COUNT(*) DESC
    LIMIT 30
  `;

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="panel-heading panel-heading-single">
          <div>
            <p className="admin-kicker">Adres göstermeyen tanılama</p>
            <h1>Kampanya hata özeti</h1>
          </div>
        </div>
        <div className="campaign-table-wrap">
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Durum</th>
                <th>Sayı</th>
                <th>Sıra aralığı</th>
                <th>Deneme</th>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.status}-${row.error_message}`}>
                  <td>{String(row.status)}</td>
                  <td>{Number(row.error_count).toLocaleString("tr-TR")}</td>
                  <td>
                    {Number(row.first_order).toLocaleString("tr-TR")}–
                    {Number(row.last_order).toLocaleString("tr-TR")}
                  </td>
                  <td>{Number(row.max_attempts)}</td>
                  <td>{String(row.error_message)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
