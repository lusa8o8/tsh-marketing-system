-- M11E: Add creative_override_allowed boolean to academic_calendar.
-- When true, the design brief agent explicitly permits palette deviation within
-- the accent color family. Defaults false — brand lock on all events unless
-- the event creator deliberately opts in (holiday, graduation, other only).
-- exam and registration types must never override (enforced in the UI layer).
ALTER TABLE academic_calendar
  ADD COLUMN IF NOT EXISTS creative_override_allowed boolean NOT NULL DEFAULT false;
