import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";

export default async function RecipientStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  await requireAdminPage();
  await ensureDatabaseSchema();
  const email = String((await searchParams).email || "").trim().toLowerCase();
  const sql = db();
  const [deliveries, suppressions] = email
    ? await Promise.all([
        sql`
          SELECT campaigns.subject, campaigns.status AS campaign_status,
                 campaigns.created_at AS campaign_created_at,
                 recipients.status AS recipient_status,
                 recipients.delivery_status,
                 recipients.attempt_count, recipients.sent_at,
                 recipients.delivered_at, recipients.last_delivery_event_at,
                 recipients.ses_message_id, recipients.error_message
          FROM campaign_recipients recipients
          JOIN campaigns ON campaigns.id = recipients.campaign_id
          WHERE lower(recipients.email) = ${email}
          ORDER BY campaigns.created_at DESC
          LIMIT 20
        `,
        sql`
          SELECT reason, source, created_at
          FROM email_suppressions
          WHERE lower(email) = ${email}
          ORDER BY created_at DESC
        `,
      ])
    : [[], []];

  return (
    <main className="admin-shell admin-detail">
      <header className="admin-header">
        <div>
          <Link className="admin-back" href="/admin">← Yönetim paneli</Link>
          <h1>Alıcı gönderim durumu</h1>
          <p>{email}</p>
        </div>
      </header>

      <section className="admin-panel">
        <h2>Engelleme durumu</h2>
        <p>{suppressions.length ? "Engellenmiş" : "Engelleme kaydı yok"}</p>
        {suppressions.map((row, index) => (
          <p key={index}>
            {String(row.reason)} · {String(row.source)} ·{" "}
            {new Date(String(row.created_at)).toLocaleString("tr-TR")}
          </p>
        ))}
      </section>

      <section className="admin-panel">
        <h2>Kampanya kayıtları</h2>
        {deliveries.length === 0 ? <p>Bu adres için kayıt bulunamadı.</p> : null}
        <div className="campaign-summary">
          {deliveries.map((row, index) => (
            <div key={index}>
              <span>{String(row.subject)}</span>
              <strong>
                {String(row.recipient_status)} / {String(row.delivery_status)}
              </strong>
              <small>
                {new Date(String(row.campaign_created_at)).toLocaleString("tr-TR")}
                {row.error_message ? ` · ${String(row.error_message)}` : ""}
              </small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
