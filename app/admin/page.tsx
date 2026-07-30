import { requireAdminPage } from "@/lib/admin-auth";
import { AdminLogoutButton, CampaignCreateForm } from "./ui";

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
