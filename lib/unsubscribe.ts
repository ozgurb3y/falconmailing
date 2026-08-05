import { db } from "./db";
import { readUnsubscribeToken } from "./security";
import { ensureDatabaseSchema } from "./schema";

export async function unsubscribeByToken(rawToken: string) {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 1024) {
    return false;
  }

  const target = readUnsubscribeToken(rawToken);
  if (!target) return false;

  await ensureDatabaseSchema();
  const sql = db();
  const rows = await sql`
    WITH target AS (
      SELECT
        ${target.contactId}::uuid AS contact_id,
        ${target.internalRecipientId}::uuid AS internal_recipient_id,
        ${target.recipientEmail}::text AS recipient_email
    ),
    updated_contact AS (
      UPDATE contacts
      SET
        status = 'unsubscribed',
        iys_status = CASE
          WHEN iys_status = 'not_required' THEN iys_status
          ELSE 'ret_pending'
        END,
        unsubscribed_at = COALESCE(unsubscribed_at, NOW()),
        updated_at = NOW()
      WHERE id = (SELECT contact_id FROM target)
      RETURNING id
    ),
    updated_consent AS (
      UPDATE consents
      SET
        status = 'withdrawn',
        withdrawn_at = COALESCE(withdrawn_at, NOW())
      WHERE contact_id = (SELECT contact_id FROM target)
        AND status IN ('pending', 'granted')
      RETURNING id
    ),
    updated_internal_recipient AS (
      UPDATE internal_recipients
      SET
        status = 'unsubscribed',
        unsubscribed_at = COALESCE(unsubscribed_at, NOW()),
        updated_at = NOW()
      WHERE id = (SELECT internal_recipient_id FROM target)
      RETURNING id
    ),
    inserted_suppression AS (
      INSERT INTO suppressions (
        id,
        contact_id,
        reason,
        source,
        created_at
      )
      SELECT
        gen_random_uuid(),
        contact_id,
        'unsubscribe',
        'recipient_link',
        NOW()
      FROM target
      WHERE contact_id IS NOT NULL
        AND NOT EXISTS (
        SELECT 1
        FROM suppressions s
        WHERE s.contact_id = target.contact_id
          AND s.reason = 'unsubscribe'
      )
      RETURNING id
    ),
    inserted_email_suppression AS (
      INSERT INTO email_suppressions (
        id,
        email,
        reason,
        source,
        created_at
      )
      SELECT
        gen_random_uuid(),
        recipient_email,
        'unsubscribe',
        'recipient_link',
        NOW()
      FROM target
      WHERE recipient_email IS NOT NULL
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING id
    )
    SELECT contact_id, internal_recipient_id, recipient_email FROM target
  `;

  return rows.length > 0;
}
