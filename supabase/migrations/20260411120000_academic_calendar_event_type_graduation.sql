-- Widen event_type check constraint to include 'graduation'.
-- The original constraint did not include 'graduation' as a valid value.
-- NOT VALID skips checking existing rows (some may have been inserted before constraints
-- were fully applied); new inserts/updates will be validated.
ALTER TABLE academic_calendar
  DROP CONSTRAINT IF EXISTS academic_calendar_event_type_check;

ALTER TABLE academic_calendar
  ADD CONSTRAINT academic_calendar_event_type_check
  CHECK (event_type IN ('exam', 'registration', 'holiday', 'orientation', 'graduation', 'other'))
  NOT VALID;
