import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type StorageRow = {
  table_name: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
  estimated_rows: number;
};

const tableLabels: Record<string, string> = {
  campaign_recipients: "Kampanya alıcı ve gönderim kayıtları",
  ses_delivery_events: "Amazon SES teslimat olayları",
  audit_logs: "Yönetim işlem kayıtları",
  campaigns: "Kampanyalar",
  contacts: "İzinli aboneler",
  consents: "E-posta izin ve onay kayıtları",
  internal_recipients: "İçe aktarılan alıcılar",
  email_suppressions: "Gönderimi engellenen e-posta adresleri",
  verification_tokens: "E-posta doğrulama bağlantıları",
  admin_login_attempts: "Yönetici giriş denemeleri",
  suppressions: "Abone engelleme kayıtları",
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** unitIndex).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })} ${units[unitIndex]}`;
}

export default async function StorageDiagnosticsPage() {
  await requireAdminPage();
  const sql = db();
  const [databaseRows, tableRows] = await Promise.all([
    sql`
      SELECT pg_database_size(current_database())::bigint AS database_bytes
    `,
    sql`
      SELECT
        relname AS table_name,
        pg_total_relation_size(relid)::bigint AS total_bytes,
        pg_relation_size(relid)::bigint AS table_bytes,
        pg_indexes_size(relid)::bigint AS index_bytes,
        n_live_tup::bigint AS estimated_rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 30
    `,
  ]);
  const databaseBytes = Number(databaseRows[0]?.database_bytes || 0);
  const tables = tableRows as StorageRow[];

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="panel-heading panel-heading-single">
          <div>
            <p className="admin-kicker">Salt okunur tanılama</p>
            <h1>Veritabanı depolama kullanımı</h1>
          </div>
        </div>
        <div className="campaign-summary">
          <div>
            <span>Toplam veritabanı boyutu</span>
            <strong>{formatBytes(databaseBytes)}</strong>
          </div>
          <div>
            <span>Otomatik temizlik</span>
            <strong>Her gün 05.00 civarı</strong>
          </div>
        </div>
        <div className="campaign-table-wrap">
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Kayıt türü</th>
                <th>Tahmini kayıt</th>
                <th>Toplam</th>
                <th>Veri</th>
                <th>İndeks</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.table_name}>
                  <td>
                    <strong>{tableLabels[table.table_name] || table.table_name}</strong>
                    {tableLabels[table.table_name] ? (
                      <small className="table-technical-name">{table.table_name}</small>
                    ) : null}
                  </td>
                  <td>{Number(table.estimated_rows).toLocaleString("tr-TR")}</td>
                  <td>{formatBytes(Number(table.total_bytes))}</td>
                  <td>{formatBytes(Number(table.table_bytes))}</td>
                  <td>{formatBytes(Number(table.index_bytes))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="send-hint">
          Tamamlanan veya iptal edilen kampanyaların alıcı ve teslimat ayrıntıları
          silinir. Kampanya toplamları, izinler ve engellemeler korunur;
          abonelikten çıkma bağlantıları için ayrı kayıt tutulmaz.
        </p>
      </section>
    </main>
  );
}
