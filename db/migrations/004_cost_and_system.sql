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
