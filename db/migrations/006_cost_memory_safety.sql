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
