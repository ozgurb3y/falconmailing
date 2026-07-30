import { requireAdminPage } from "@/lib/admin-auth";
import {
  AdminLogoutButton,
  CampaignCreateForm,
  DeliveryMonitor,
} from "./ui";

export default async function AdminDashboard() {
  await requireAdminPage();

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

      <section className="admin-panel">
        <div className="panel-heading panel-heading-single">
          <div>
            <p className="admin-kicker">Yeni gönderim</p>
            <h1>Kampanya oluştur</h1>
          </div>
        </div>
        <CampaignCreateForm />
      </section>

      <DeliveryMonitor />
    </main>
  );
}
