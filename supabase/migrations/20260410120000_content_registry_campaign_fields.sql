-- Add campaign grouping fields to content_registry
-- Required for Milestone 7C batch approval in Content Registry

ALTER TABLE content_registry
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS pipeline_run_id uuid;
