import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { AdminLogoutButton, CampaignCreateForm } from "./ui";

export default async function AdminDashboard() {
  await requireAdminPage();
  await ensureDatabaseSchema();
  const sql = db();
  const metricsRows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE iys_status = 'pending_registration')::int AS iys_pending,
      (SELECT COUNT(*)::int FROM marketing_eligible_contacts) AS eligible,
      (SELECT COUNT(*)::int FROM suppressions) AS suppressed
    FROM contacts
  `;
  const metrics = metricsRows[0] as Record<string, number>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-brand">
            Falcon<span>Mailing</span>
          </div>
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
            <p className="admin-kicker">Yeni gönderim</p>
            <h1>Kampanya oluştur</h1>
          </div>
          <p>
            Şirket içi gönderimde yalnızca bu formda o anda girdiğiniz adresler
            kullanılır. Adresler kalıcı bir şirket listesine kaydedilmez.
          </p>
        </div>
        <CampaignCreateForm />
      </section>
    </main>
  );
}
