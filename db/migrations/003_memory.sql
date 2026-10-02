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
