import { db } from "./db";
import { hashToken } from "./security";
import { ensureDatabaseSchema } from "./schema";

export async function unsubscribeByToken(rawToken: string) {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 256) {
    return false;
  }

  await ensureDatabaseSchema();
  const sql = db();
  const tokenHash = hashToken(rawToken);
  const rows = await sql`
    WITH target AS (
      SELECT contact_id
      FROM unsubscribe_tokens
      WHERE token_hash = ${tokenHash}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
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
      WHERE NOT EXISTS (
        SELECT 1
        FROM suppressions s
        WHERE s.contact_id = target.contact_id
          AND s.reason = 'unsubscribe'
      )
      RETURNING id
    )
    UPDATE unsubscribe_tokens
    SET used_at = COALESCE(used_at, NOW())
    WHERE token_hash = ${tokenHash}
    RETURNING contact_id
  `;

  return rows.length > 0;
}
