CREATE TABLE IF NOT EXISTS commander_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  domain text NOT NULL CHECK (domain IN ('private_operations','commercial_research','director_operations')),
  status text NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review','queued','in_progress','blocked','completed','failed')),
  payload_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commander_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES commander_missions(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','awaiting_review','in_progress','blocked','completed','failed')),
  depends_on uuid[] NOT NULL DEFAULT '{}',
  requires_director_review boolean NOT NULL DEFAULT false,
  external_action_enabled boolean NOT NULL DEFAULT false CHECK (external_action_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, agent_id)
);

CREATE INDEX IF NOT EXISTS commander_missions_recent_idx ON commander_missions(created_at DESC);
CREATE INDEX IF NOT EXISTS commander_jobs_mission_idx ON commander_jobs(mission_id, created_at);
ALTER TABLE commander_jobs ADD COLUMN IF NOT EXISTS execution_enabled boolean NOT NULL DEFAULT false CHECK (execution_enabled = false);

CREATE TABLE IF NOT EXISTS commander_audit_events (
  id bigserial PRIMARY KEY,
  mission_id uuid REFERENCES commander_missions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('mission_created','job_planned','mission_viewed')),
  agent_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
