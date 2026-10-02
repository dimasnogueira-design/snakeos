CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
