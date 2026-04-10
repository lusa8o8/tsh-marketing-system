-- Add extended org profile fields to org_config.
-- These are surfaced in Settings → Organisation Details and written by useUpdateOrgConfig.
ALTER TABLE org_config
  ADD COLUMN IF NOT EXISTS full_name     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '';
