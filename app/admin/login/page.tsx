import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminLoginForm } from "../ui";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <div className="admin-brand">
          Falcon<span>Mailing</span>
        </div>
        <p className="admin-kicker">Güvenli yönetim alanı</p>
        <h1>Yönetim paneline giriş</h1>
        <p>
          Kampanyalar ve izinli abone verileri yalnızca yetkili yönetici
          oturumunda görüntülenebilir.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}

