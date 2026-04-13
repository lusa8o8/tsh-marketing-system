ALTER TABLE content_registry
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
