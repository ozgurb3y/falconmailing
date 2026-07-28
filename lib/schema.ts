import { db } from "./db";

const statements = [
  `CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'active', 'unsubscribed', 'suppressed')),
    iys_status TEXT NOT NULL DEFAULT 'pending_registration'
      CHECK (iys_status IN ('pending_registration', 'onay', 'ret_pending', 'ret', 'not_required')),
    email_verified_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    suppression_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_lower_unique
    ON contacts ((lower(email)))`,
  `CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts (status)`,
  `CREATE INDEX IF NOT EXISTS contacts_iys_status_idx ON contacts (iys_status)`,
  `CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'granted', 'withdrawn')),
    channel TEXT NOT NULL DEFAULT 'email',
    purpose TEXT NOT NULL DEFAULT 'marketing',
    text_version TEXT NOT NULL,
    source TEXT NOT NULL,
    ip_hash CHAR(64) NOT NULL,
    user_agent TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS consents_contact_idx ON consents (contact_id)`,
  `CREATE INDEX IF NOT EXISTS consents_ip_requested_idx
    ON consents (ip_hash, requested_at DESC)`,
  `CREATE TABLE IF NOT EXISTS verification_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    consent_id UUID NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS verification_tokens_contact_idx
    ON verification_tokens (contact_id)`,
  `CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    campaign_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS unsubscribe_tokens_contact_idx
    ON unsubscribe_tokens (contact_id)`,
  `CREATE TABLE IF NOT EXISTS suppressions (
    id UUID PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'hard_bounce', 'complaint', 'manual')),
    source TEXT NOT NULL,
    ses_message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS suppressions_contact_idx ON suppressions (contact_id)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE OR REPLACE VIEW marketing_eligible_contacts AS
    SELECT c.id, c.email, c.name, c.email_verified_at
    FROM contacts c
    WHERE c.status = 'active'
      AND c.email_verified_at IS NOT NULL
      AND c.iys_status IN ('onay', 'not_required')
      AND NOT EXISTS (
        SELECT 1 FROM suppressions s WHERE s.contact_id = c.id
      )`,
] as const;

let schemaPromise: Promise<void> | undefined;

export function ensureDatabaseSchema() {
  schemaPromise ??= (async () => {
    const sql = db();
    for (const statement of statements) {
      await sql.query(statement);
    }
  })().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });

  return schemaPromise;
}
