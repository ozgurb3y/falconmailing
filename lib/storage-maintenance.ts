import { db } from "@/lib/db";

export type StorageCleanupResult = {
  mode: "truncate" | "targeted";
  recipientsDeleted: number;
  eventsDeleted: number;
  verificationTokensDeleted: number;
  loginAttemptsDeleted: number;
};

type CountRow = {
  recipients_deleted?: number | string;
  events_deleted?: number | string;
  verification_tokens_deleted?: number | string;
  login_attempts_deleted?: number | string;
};

function count(value: number | string | undefined) {
  return Number(value || 0);
}

export async function cleanupCompletedCampaignData(): Promise<StorageCleanupResult> {
  const sql = db();
  const activeRows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM campaign_recipients recipients
      JOIN campaigns ON campaigns.id = recipients.campaign_id
      WHERE recipients.status IN ('queued', 'processing')
        AND (
          campaigns.status IN ('sending', 'paused')
          OR (
            campaigns.status = 'draft'
            AND campaigns.updated_at > NOW() - INTERVAL '1 hour'
          )
        )
    ) AS has_active_recipients
  `;
  const hasActiveRecipients = Boolean(activeRows[0]?.has_active_recipients);

  let mode: StorageCleanupResult["mode"] = "targeted";
  let recipientsDeleted = 0;
  let eventsDeleted = 0;

  if (!hasActiveRecipients) {
    const rows = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM campaign_recipients) AS recipients_deleted,
        (SELECT COUNT(*)::int FROM ses_delivery_events) AS events_deleted
    `;
    const before = rows[0] as CountRow | undefined;
    recipientsDeleted = count(before?.recipients_deleted);
    eventsDeleted = count(before?.events_deleted);
    await sql`TRUNCATE TABLE ses_delivery_events, campaign_recipients`;
    mode = "truncate";
  } else {
    const rows = await sql`
      WITH completed_recipients AS MATERIALIZED (
        SELECT recipients.id, recipients.ses_message_id
        FROM campaign_recipients recipients
        JOIN campaigns ON campaigns.id = recipients.campaign_id
        WHERE campaigns.status IN ('completed', 'cancelled')
      ),
      deleted_events AS (
        DELETE FROM ses_delivery_events events
        WHERE EXISTS (
          SELECT 1 FROM completed_recipients recipients
          WHERE recipients.ses_message_id = events.ses_message_id
        )
        RETURNING 1
      ),
      deleted_recipients AS (
        DELETE FROM campaign_recipients recipients
        WHERE EXISTS (
          SELECT 1 FROM completed_recipients completed
          WHERE completed.id = recipients.id
        )
        RETURNING 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM deleted_recipients) AS recipients_deleted,
        (SELECT COUNT(*)::int FROM deleted_events) AS events_deleted
    `;
    const deleted = rows[0] as CountRow | undefined;
    recipientsDeleted = count(deleted?.recipients_deleted);
    eventsDeleted = count(deleted?.events_deleted);
  }

  const housekeepingRows = await sql`
    WITH deleted_orphan_events AS (
      DELETE FROM ses_delivery_events events
      WHERE events.created_at < NOW() - INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM campaign_recipients recipients
          WHERE recipients.ses_message_id = events.ses_message_id
        )
      RETURNING 1
    ),
    deleted_verification_tokens AS (
      DELETE FROM verification_tokens
      WHERE created_at < NOW() - INTERVAL '7 days'
        AND (used_at IS NOT NULL OR expires_at < NOW())
      RETURNING 1
    ),
    deleted_login_attempts AS (
      DELETE FROM admin_login_attempts
      WHERE created_at < NOW() - INTERVAL '30 days'
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM deleted_orphan_events) AS events_deleted,
      (SELECT COUNT(*)::int FROM deleted_verification_tokens)
        AS verification_tokens_deleted,
      (SELECT COUNT(*)::int FROM deleted_login_attempts)
        AS login_attempts_deleted
  `;
  const housekeeping = housekeepingRows[0] as CountRow | undefined;
  await sql`
    UPDATE campaigns
    SET name = 'Tamamlanan kampanya',
        subject = 'Tamamlanan kampanya',
        preview_text = NULL,
        heading = '',
        content = '',
        cta_label = NULL,
        cta_url = NULL,
        html_content = NULL,
        worker_token = NULL,
        worker_lease_until = NULL,
        updated_at = NOW()
    WHERE status IN ('completed', 'cancelled')
      AND (
        name <> 'Tamamlanan kampanya'
        OR subject <> 'Tamamlanan kampanya'
        OR preview_text IS NOT NULL
        OR heading <> ''
        OR content <> ''
        OR cta_label IS NOT NULL
        OR cta_url IS NOT NULL
        OR html_content IS NOT NULL
        OR worker_token IS NOT NULL
        OR worker_lease_until IS NOT NULL
      )
  `;
  await sql`DROP TABLE IF EXISTS unsubscribe_tokens`;

  return {
    mode,
    recipientsDeleted,
    eventsDeleted: eventsDeleted + count(housekeeping?.events_deleted),
    verificationTokensDeleted: count(housekeeping?.verification_tokens_deleted),
    loginAttemptsDeleted: count(housekeeping?.login_attempts_deleted),
  };
}
