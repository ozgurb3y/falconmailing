import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ensureDatabaseSchema } from "@/lib/schema";
import { CampaignSender } from "../../ui";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  await ensureDatabaseSchema();
  const { id } = await params;
  const sql = db();
  const rows = await sql`
    SELECT *,
      (
        SELECT COUNT(*)::int
        FROM campaign_recipients r
        WHERE r.campaign_id = campaigns.id
          AND r.status IN ('queued', 'processing')
      ) AS remaining
    FROM campaigns
    WHERE id = ${id}
    LIMIT 1
  `;
  const campaign = rows[0];
  if (!campaign) notFound();

  return (
    <main className="admin-shell admin-detail">
      <header className="admin-header">
        <div>
          <Link className="admin-back" href="/admin">← Yeni kampanya</Link>
          <h1>{String(campaign.name)}</h1>
          <p>{String(campaign.subject)}</p>
        </div>
      </header>

      <section className="admin-panel">
        <div className="campaign-summary">
          <div><span>Durum</span><strong>{String(campaign.status)}</strong></div>
          <div><span>Alıcı görüntüsü</span><strong>{Number(campaign.audience_count)}</strong></div>
          <div><span>Alıcı grubu</span><strong>{campaign.audience_type === "internal" ? "Gönderime özel adresler" : "İzinli aboneler"}</strong></div>
          <div><span>Oluşturuldu</span><strong>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(campaign.created_at)))}</strong></div>
        </div>
        <CampaignSender
          campaignId={id}
          initial={{
            status: String(campaign.status),
            sent_count: Number(campaign.sent_count),
            failed_count: Number(campaign.failed_count),
            skipped_count: Number(campaign.skipped_count),
            remaining: Number(campaign.remaining),
          }}
        />
      </section>

      <section className="admin-panel email-preview">
        <p className="admin-kicker">
          {campaign.content_mode === "html" ? "HTML e-posta ön izlemesi" : "İçerik özeti"}
        </p>
        {campaign.content_mode === "html" && campaign.html_content ? (
          <iframe
            className="html-preview-frame html-preview-detail"
            sandbox=""
            srcDoc={String(campaign.html_content)}
            title="HTML e-posta ön izlemesi"
          />
        ) : (
          <>
            <h2>{String(campaign.heading)}</h2>
            <div className="preview-content">
              {String(campaign.content)
                .split(/\n{2,}/)
                .map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            {campaign.cta_label && campaign.cta_url ? (
              <a href={String(campaign.cta_url)} rel="noreferrer" target="_blank">
                {String(campaign.cta_label)}
              </a>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
