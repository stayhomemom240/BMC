-- Apply to the verified application database during a deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.lead_audit_consultation_requests
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested',
    ADD COLUMN IF NOT EXISTS response_message text,
    ADD COLUMN IF NOT EXISTS response_slot_start timestamptz,
    ADD COLUMN IF NOT EXISTS meeting_url text,
    ADD COLUMN IF NOT EXISTS responded_at timestamptz;
COMMIT;
