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
