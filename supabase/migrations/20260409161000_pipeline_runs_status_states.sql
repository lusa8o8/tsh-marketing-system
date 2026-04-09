-- Milestone 6: allow persisted human-gate pipeline run states.
ALTER TABLE public.pipeline_runs
  DROP CONSTRAINT IF EXISTS pipeline_runs_status_check;

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_status_check
  CHECK (
    status IN (
      'queued',
      'running',
      'waiting_human',
      'resumed',
      'success',
      'completed',
      'failed',
      'cancelled',
      'canceled'
    )
  );
