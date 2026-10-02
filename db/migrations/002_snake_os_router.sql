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
