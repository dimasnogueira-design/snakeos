CREATE SCHEMA snake;
SET LOCAL search_path = snake, pg_catalog;


CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  display_name text NOT NULL,
  is_protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  claimed_amount_cents bigint,
  confirmed_amount_cents bigint,
  summary text NOT NULL DEFAULT '',
  risk_level text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  external_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  author text NOT NULL CHECK (author IN ('dimas','counterparty','agent')),
  body text NOT NULL DEFAULT '',
  media_type text,
  transcript text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_case_occurred_idx ON messages(case_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS confirmed_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value text NOT NULL,
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE TABLE IF NOT EXISTS negotiation_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  may_acknowledge_debt boolean NOT NULL DEFAULT false,
  may_offer_installments boolean NOT NULL DEFAULT false,
  may_offer_discount boolean NOT NULL DEFAULT false,
  max_immediate_payment_cents bigint,
  max_installment_cents bigint,
  earliest_commitment_date date,
  forbidden_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  proposed_by text NOT NULL CHECK (proposed_by IN ('dimas','counterparty','agent')),
  amount_cents bigint,
  installments int,
  due_date date,
  terms text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  intent text NOT NULL,
  risk text NOT NULL,
  strategy text NOT NULL,
  proposed_reply text NOT NULL,
  creates_commitment boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by_user boolean,
  sent_at timestamptz,
  raw_decision jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS contact_mode text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS is_existing_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_contact_mode_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_contact_mode_check
    CHECK (contact_mode IN ('unknown','venom_sales','venom_support','negotiation','personal','protected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contact_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  selected_mode text NOT NULL CHECK (selected_mode IN ('unknown','venom_sales','venom_support','negotiation','personal','protected')),
  detected_intent text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_routes_contact_created_idx ON contact_routes(contact_id, created_at DESC);

-- SNAKE OS v0.3 — memória unificada por contato/caso.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE;

-- Preenche contact_id a partir do caso para registros antigos.
UPDATE messages m
SET contact_id = c.contact_id
FROM cases c
WHERE m.case_id = c.id AND m.contact_id IS NULL;

-- Mensagens comerciais/pessoais podem não pertencer a um caso financeiro.
ALTER TABLE messages ALTER COLUMN case_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS messages_contact_occurred_idx
  ON messages(contact_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique_idx
  ON messages(external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  salient_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  open_loops jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_message_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_summaries_contact_general_unique
  ON conversation_summaries(contact_id)
  WHERE case_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_summaries_case_unique
  ON conversation_summaries(case_id)
  WHERE case_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS protected_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  external_id text UNIQUE,
  display_name text,
  reason text NOT NULL DEFAULT 'protected',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SNAKE OS v0.4 — custo, notificações automáticas e auditoria de IA.
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_mode_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_contact_mode_check
  CHECK (contact_mode IN ('unknown','venom_sales','venom_support','negotiation','personal','protected','system'));

CREATE TABLE IF NOT EXISTS ai_usage (
  id bigserial PRIMARY KEY,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  purpose text NOT NULL,
  model text NOT NULL,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_contact_idx ON ai_usage(contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_notifications (
  id bigserial PRIMARY KEY,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  external_message_id text,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('ignore','info','important')),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SNAKE OS v0.5 — painel administrativo, take-over e modo operacional.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS automation_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_last_message_idx ON contacts(last_message_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('automation_mode', '"observation"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('whatsapp_status', '"disconnected"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS operational_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_events_created_idx ON operational_events(created_at DESC);

ALTER TABLE ai_usage ADD COLUMN status text NOT NULL DEFAULT 'complete',
  ADD COLUMN cost_micros bigint NOT NULL DEFAULT 0 CHECK(cost_micros>=0),
  ADD COLUMN reserved_micros bigint NOT NULL DEFAULT 0 CHECK(reserved_micros>=0),
  ADD COLUMN cached_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN duration_seconds numeric,
  ADD COLUMN error_code text,
  ADD COLUMN request_id text;
ALTER TABLE conversation_summaries ADD COLUMN context_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN revision bigint NOT NULL DEFAULT 0;
ALTER TABLE agent_decisions ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN occurred_at_raw text;
ALTER TABLE agent_decisions ADD COLUMN contact_id uuid REFERENCES contacts(id),
  ADD COLUMN reply_parts jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX decisions_source_unique ON agent_decisions(source_message_id) WHERE source_message_id IS NOT NULL;
ALTER TABLE contact_routes DROP CONSTRAINT IF EXISTS contact_routes_selected_mode_check;
ALTER TABLE contact_routes ADD CONSTRAINT contact_routes_selected_mode_check CHECK(selected_mode IN ('unknown','venom_sales','venom_support','negotiation','personal','protected','system'));

CREATE TABLE ingress_events (
  event_key text PRIMARY KEY, contact_id text NOT NULL, status text NOT NULL DEFAULT 'claimed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contact_leases (external_id text PRIMARY KEY, token uuid NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE audio_transcripts (
  contact_id uuid NOT NULL REFERENCES contacts(id), content_hash text NOT NULL,
  transcript text NOT NULL, duration_seconds numeric NOT NULL, model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(contact_id,content_hash)
);
CREATE TABLE message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id),
  filename text NOT NULL, mime_type text NOT NULL, sha256 text, local_path text,
  UNIQUE(message_id,filename)
);
CREATE TABLE handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES contacts(id),
  source_message_id uuid REFERENCES messages(id), from_persona text NOT NULL, to_persona text NOT NULL,
  state text NOT NULL DEFAULT 'HANDOFF_CONTEXT_READY', context_packet jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_message_id uuid UNIQUE NOT NULL REFERENCES messages(id),
  contact_id uuid NOT NULL REFERENCES contacts(id), parts jsonb NOT NULL, next_part int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE alerts (
  id bigserial PRIMARY KEY, contact_id uuid REFERENCES contacts(id), code text NOT NULL,
  severity text NOT NULL DEFAULT 'important', resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_unresolved_idx ON alerts(created_at DESC) WHERE resolved_at IS NULL;
INSERT INTO system_settings(setting_key,setting_value) VALUES
  ('ai_circuit','{"open":false,"failures":0}'::jsonb),
  ('cost_limits','{}'::jsonb) ON CONFLICT DO NOTHING;
-- Existing usage without price cannot be reconciled automatically. It blocks paid calls until reviewed.
UPDATE ai_usage SET status='unreconciled' WHERE input_tokens IS NULL OR cost_micros=0;

REVOKE ALL ON SCHEMA snake FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA snake FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA snake FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA snake REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
DO $safe$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='snake' LOOP EXECUTE format('ALTER TABLE snake.%I ENABLE ROW LEVEL SECURITY',t.tablename); END LOOP; END $safe$;
