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
  `CREATE UNIQUE INDEX IF NOT EXISTS suppressions_contact_reason_unique
    ON suppressions (contact_id, reason)`,
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
  `CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id UUID PRIMARY KEY,
    ip_hash CHAR(64) NOT NULL,
    successful BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_created_idx
    ON admin_login_attempts (ip_hash, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS internal_recipients (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'unsubscribed', 'suppressed')),
    source TEXT NOT NULL DEFAULT 'admin_internal_list',
    added_by TEXT NOT NULL DEFAULT 'admin',
    authorization_note TEXT NOT NULL,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS internal_recipients_email_lower_unique
    ON internal_recipients ((lower(email)))`,
  `CREATE INDEX IF NOT EXISTS internal_recipients_status_idx
    ON internal_recipients (status)`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    preview_text TEXT,
    heading TEXT NOT NULL,
    content TEXT NOT NULL,
    cta_label TEXT,
    cta_url TEXT,
    content_mode TEXT NOT NULL DEFAULT 'template'
      CHECK (content_mode IN ('template', 'html')),
    html_content TEXT,
    audience_type TEXT NOT NULL DEFAULT 'marketing'
      CHECK (audience_type IN ('marketing', 'internal')),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'sending', 'paused', 'completed', 'cancelled')),
    audience_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS campaigns_created_idx
    ON campaigns (created_at DESC)`,
  `ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS audience_type TEXT NOT NULL DEFAULT 'marketing'
      CHECK (audience_type IN ('marketing', 'internal'))`,
  `ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS content_mode TEXT NOT NULL DEFAULT 'template'
      CHECK (content_mode IN ('template', 'html'))`,
  `ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS html_content TEXT`,
  `ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS worker_token UUID`,
  `ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS worker_lease_until TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS email_suppressions (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'unsubscribe',
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_email_lower_unique
    ON email_suppressions ((lower(email)))`,
  `CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    internal_recipient_id UUID REFERENCES internal_recipients(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'skipped')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    ses_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, contact_id),
    UNIQUE (campaign_id, internal_recipient_id),
    CHECK (NOT (contact_id IS NOT NULL AND internal_recipient_id IS NOT NULL))
  )`,
  `ALTER TABLE campaign_recipients
    ALTER COLUMN contact_id DROP NOT NULL`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS internal_recipient_id UUID
      REFERENCES internal_recipients(id) ON DELETE CASCADE`,
  `ALTER TABLE campaign_recipients
    DROP CONSTRAINT IF EXISTS campaign_recipients_check`,
  `ALTER TABLE campaign_recipients
    DROP CONSTRAINT IF EXISTS campaign_recipients_target_check`,
  `ALTER TABLE campaign_recipients
    ADD CONSTRAINT campaign_recipients_target_check
      CHECK (NOT (contact_id IS NOT NULL AND internal_recipient_id IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_internal_unique
    ON campaign_recipients (campaign_id, internal_recipient_id)
    WHERE internal_recipient_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_status_idx
    ON campaign_recipients (campaign_id, status)`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS rfc_message_id TEXT`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'unknown'
      CHECK (delivery_status IN (
        'unknown', 'accepted', 'delivered', 'delayed', 'bounced',
        'complained', 'rejected', 'rendering_failed'
      ))`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS last_delivery_event_at TIMESTAMPTZ`,
  `ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS delivery_event_detail JSONB`,
  `CREATE INDEX IF NOT EXISTS campaign_recipients_ses_message_idx
    ON campaign_recipients (ses_message_id)
    WHERE ses_message_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS ses_delivery_events (
    sns_message_id TEXT PRIMARY KEY,
    ses_message_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_at TIMESTAMPTZ NOT NULL,
    recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS ses_delivery_events_message_idx
    ON ses_delivery_events (ses_message_id, event_at DESC)`,
  `CREATE INDEX IF NOT EXISTS campaigns_stalled_worker_idx
    ON campaigns (worker_lease_until)
    WHERE status = 'sending'`,
  `ALTER TABLE unsubscribe_tokens
    ALTER COLUMN contact_id DROP NOT NULL`,
  `ALTER TABLE unsubscribe_tokens
    ADD COLUMN IF NOT EXISTS internal_recipient_id UUID
      REFERENCES internal_recipients(id) ON DELETE CASCADE`,
  `ALTER TABLE unsubscribe_tokens
    ADD COLUMN IF NOT EXISTS recipient_email TEXT`,
  `CREATE INDEX IF NOT EXISTS unsubscribe_tokens_internal_idx
    ON unsubscribe_tokens (internal_recipient_id)`,
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
