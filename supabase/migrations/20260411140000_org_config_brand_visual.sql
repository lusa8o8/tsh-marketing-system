-- M11E: Add brand_visual JSONB column and markdown_design_spec text column to org_config.
-- brand_visual holds structured palette, typography, logo, and photography rules
-- injected verbatim into every design brief to eliminate hallucinated brand identity.
-- markdown_design_spec is a freeform override written by the brand manager
-- and injected verbatim after the structured brand_visual fields.
ALTER TABLE org_config
  ADD COLUMN IF NOT EXISTS brand_visual       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS markdown_design_spec text;
