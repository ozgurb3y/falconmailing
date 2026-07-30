import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import {
  AdminLogoutButton,
  CampaignCreateForm,
} from "./ui";

function statusLabel(status: string) {
  return {
    draft: "Taslak",
    sending: "Gönderiliyor",
    paused: "Duraklatıldı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
  }[status] || status;
}

export default async function AdminDashboard() {
  await requireAdminPage();
  await ensureDatabaseSchema();
  const sql = db();
  const [metricsRows, campaignRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE iys_status = 'pending_registration')::int AS iys_pending,
        (SELECT COUNT(*)::int FROM marketing_eligible_contacts) AS eligible,
        (SELECT COUNT(*)::int FROM suppressions) AS suppressed
      FROM contacts
    `,
    sql`
      SELECT
        id, name, subject, status, audience_count,
        sent_count, failed_count, skipped_count, created_at
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT 30
    `,
  ]);
  const metrics = metricsRows[0] as Record<string, number>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-brand">Falcon<span>Mailing</span></div>
          <p>Kampanya yönetim paneli</p>
        </div>
        <AdminLogoutButton />
      </header>

      <section className="admin-metrics">
        <article><span>Toplam kayıt</span><strong>{metrics.total}</strong></article>
        <article><span>Doğrulanmış</span><strong>{metrics.active}</strong></article>
        <article className="metric-primary"><span>Gönderime uygun</span><strong>{metrics.eligible}</strong></article>
        <article><span>İYS bekleyen</span><strong>{metrics.iys_pending}</strong></article>
        <article><span>Engellenen</span><strong>{metrics.suppressed}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="admin-kicker">Yeni çalışma</p>
            <h1>Kampanya oluştur</h1>
          </div>
          <p>
            Abonelikten çıkan, doğrulanmamış, İYS durumu uygun olmayan veya
            engellenmiş adresler otomatik olarak dışarıda bırakılır.
          </p>
        </div>
        <CampaignCreateForm />
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="admin-kicker">Geçmiş</p>
            <h2>Kampanyalar</h2>
          </div>
        </div>
        {campaignRows.length ? (
          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Kampanya</th>
                  <th>Durum</th>
                  <th>Alıcı</th>
                  <th>Gönderilen</th>
                  <th>Başarısız</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      <Link href={`/admin/campaigns/${row.id}`}>
                        <strong>{String(row.name)}</strong>
                        <span>{String(row.subject)}</span>
                      </Link>
                    </td>
                    <td><span className={`status status-${row.status}`}>{statusLabel(String(row.status))}</span></td>
                    <td>{Number(row.audience_count)}</td>
                    <td>{Number(row.sent_count)}</td>
                    <td>{Number(row.failed_count)}</td>
                    <td>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(row.created_at)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">Henüz kampanya oluşturulmadı.</p>
        )}
      </section>
    </main>
  );
}

