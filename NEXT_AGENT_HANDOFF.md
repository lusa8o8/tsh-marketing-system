# Next Agent Handoff

## Repo
- Root: `C:\Users\Lusa\tsh-marketing-system`
- Main app: `C:\Users\Lusa\tsh-marketing-system\M.A.S UI`
- Supabase project ref: `jxmdwltfkxstiwnwwiuf`
- GitHub repo: `https://github.com/lusa8o8/tsh-marketing-system.git`

## Working Discipline
Carry this forward exactly.

1. Do discovery first.
2. State diagnosis explicitly.
3. State a concrete plan before editing.
4. Keep changes narrow and reversible.
5. Commit every stable slice.
6. Push stable checkpoints to `main` when requested.
7. Avoid speculative cleanup.

This discipline has kept the product clean and lean. Do not regress into broad exploratory edits without a locked plan.

## If The Session Breaks Or Rate Limits Hit
Before touching code again, reread the relevant docs for full context:
- `NEXT_AGENT_HANDOFF.md`
- `SAMM_IMPLEMENTATION_ROADMAP.md`
- `SAMM_FULL_SYSTEM_ARCHITECTURE.md`
- `SAMM_RUNTIME_SPEC.md`
- `SAMM_SCHEDULER_CONTRACT.md`
- `SAMM_CODEBASE_MAPPING.md`

Then continue with the same discipline:
- discovery
- diagnosis
- plan
- narrow execution
- verification
- commit

## Product State
Brand and product direction are now centered on `samm`.

Current product stance:
- `samm` is the product anchor.
- Hybrid control-plane model is the intended architecture.
- Full `samm` workspace redesign is deferred until after user feedback.
- Near-term UI changes, if any, should stay narrow and focus on Inbox and Content Registry, especially tab treatment.
- Optional modules like `Calendar` and `Ambassadors` are planned for onboarding/capability gating later, not implemented yet.

## Key Completed Slices
### Branding and UI
- login rebrand to `samm`
- human-centered login imagery
- dashboard shell rebrand
- `samm` promoted to top-level nav
- `Operations` replaces `Agent Manager`

### Backend / Infra
- auth wired through Supabase
- cron slice completed manually in Supabase dashboard
- `coordinator-chat` edge function implemented, committed, pushed, deployed, and browser-verified
- scheduler extraction completed
- normalized pipeline run status contract introduced in shared runtime code
- agent registry slice completed
- integration registry slice completed, committed, pushed, deployed, and parity-verified
- Pipeline A rebuilt on the shared engine, committed, pushed, deployed, and parity-verified
- Pipeline B and Pipeline C invocation baseline restored and pushed in the Milestone 5A checkpoint

### Architecture Docs
Committed and pushed:
- `SAMM_RUNTIME_SPEC.md`
- `SAMM_SCHEDULER_CONTRACT.md`
- `SAMM_CODEBASE_MAPPING.md`
- `SAMM_IMPLEMENTATION_ROADMAP.md`

## Latest Important Commits
- `a127214 fix: query waiting_human run directly in scheduler resume path`
- `ae5138c fix: accept scheduler org_id for pipeline b and c`
- `16119f9 docs: add pipeline b and c stability milestones`
- `63fc7a4 docs: update handoff for pipeline b slice`

These are already pushed to `main`.

## Current Status
The current runtime is stable through the Milestone 5A boundary.

Verified:
- `/samm` can run Pipeline A successfully
- inbox and Operations overview reflect the latest Pipeline A output
- integration-registry wiring did not change Pipeline A behavior
- engine-backed Pipeline A returns the same hosted parity result as the pre-engine baseline:
  - `comments_processed: 7`
  - `replies_sent: 5`
  - `escalations: 2`
  - `boosts_suggested: 2`
  - `spam_ignored: 0`
  - `errors: []`
- Pipeline B invocation from `coordinator-chat` is stable again
- Pipeline C invocation from `coordinator-chat` is stable again
- both deployed functions accept the scheduler-style `org_id` payload
- hosted direct invocation returned `ok: true` for both pipelines after deployment
- Pipeline C first human gate is now implemented and deployed
- hosted direct invocation of Pipeline C now returns `waiting_human: true` and creates a real CEO `campaign_brief` inbox item

## Exact Next Slice
### Goal
Add the first long-window resumable gate for Pipeline C without widening scope into the second human gate or the monitoring loop.

### Required workflow
1. Discovery:
   - read the current `pipeline-c-campaign` implementation end to end
   - map research, brief generation, copy creation, design brief, approval, scheduling, monitoring, and reporting phases
   - inspect current Inbox and Content actions that can already carry campaign brief and draft approvals
   - inspect the scheduler and shared pipeline status contract for pause/resume hooks
2. Diagnosis:
   - state exactly which parts of Pipeline C are still hardcoded
   - separate the minimum first human-gate slice from later marketer-gate and monitoring-loop work
3. Plan:
   - define the smallest slice that introduces a real persisted CEO campaign-brief gate with `waiting_human` and `resumed`
4. Edit:
   - keep the first Pipeline C gate slice narrow and reversible
5. Verify:
   - initial Pipeline C run creates a persisted run row and pauses cleanly in `waiting_human`
   - the CEO campaign brief is visible and actionable from Inbox
   - approval triggers resume through scheduler-backed behavior
   - rejection exits cleanly to `cancelled`
   - do not widen the first checkpoint into the marketer gate or monitor-loop resumability unless required for a clean runtime path
6. Commit stable slice
7. Push if requested

## Current Milestone 7 State
Implemented, deployed, and verified end to end:
- `pipeline-c-campaign` creates a real `pipeline_runs` row
- the initial Pipeline C run stops after campaign brief creation with `waiting_human`
- the run persists `campaign_brief_inbox_id`, `campaign_brief`, and `calendar_event` into `pipeline_runs.result`
- Pipeline C accepts `resume_run_id`
- Inbox approval actions trigger `resume pipeline c` through `coordinator-chat`
- the scheduler `resumePipelineRun` now queries `pipeline_runs` directly for the `waiting_human` run instead of relying on the pre-loaded 8-row snapshot

Bug fixed and committed (`a127214`):
- root cause: `resumePipelineRun` used `getLatestPipelineRun(runs, pipeline.id)` from the pre-loaded runs snapshot, which is limited to 8 rows across all pipelines. With 31 total runs across 4 pipelines, the pipeline C `waiting_human` run could fall outside the snapshot or a more recent terminal-state run could be returned instead, causing the resume to silently no-op.
- fix: `resumePipelineRun` now does a targeted query for the most recent `waiting_human` run for the pipeline, bypassing the snapshot entirely.

Verified:
- direct hosted invocation of `pipeline-c-campaign` with `resume_run_id: 6a314f0b` returned `ok: true, resumed: true, copy_assets_created: 6, errors: []`
- run `6a314f0b` is now `success` in the DB
- `coordinator-chat` deployed with the fix

## Exact Next Slice
### Goal
Run a clean end-to-end browser test of the Pipeline C approval-to-resume flow from the app itself, then mark Milestone 7 first gate as fully verified and commit that as the stable checkpoint.

## Why Pipeline C Is Next
- the roadmap and architecture docs define Pipeline C as the next major execution milestone after Pipeline B resumability
- it is the first true long-window workflow with multiple human gates
- the first CEO brief gate is the smallest meaningful checkpoint that proves Pipeline C can pause and resume across sessions without batching the full campaign lifecycle into one rewrite

## After This Slice
1. Add the second Pipeline C human gate for marketer approval of campaign assets.
2. Add Pipeline C monitoring-loop and post-campaign resumability.
3. Move to onboarding/capability-template work once the execution core is stable.
4. Add usage metering and billing enforcement.
5. Swap mocked adapters for live provider APIs only after the engine and gate boundaries are stable.

## Relevant Files
### Frontend
- `M.A.S UI/src/pages/agent/chat.tsx`
- `M.A.S UI/src/lib/api.ts`
- `M.A.S UI/src/lib/supabase.ts`
- any Content review UI that approves or rejects drafts

### Supabase
- `supabase/functions/pipeline-b-weekly/index.ts`
- `supabase/functions/pipeline-c-campaign/index.ts`
- `supabase/functions/coordinator-chat/index.ts`
- `supabase/functions/coordinator-chat/scheduler.ts`
- `supabase/functions/_shared/pipeline-engine.ts`
- `supabase/functions/_shared/agent-registry.ts`
- `supabase/functions/_shared/integration-registry.ts`
- `supabase/functions/_shared/pipeline-run-status.ts`
- `supabase/config.toml`

### Architecture Source Of Truth
- `SAMM_RUNTIME_SPEC.md`
- `SAMM_SCHEDULER_CONTRACT.md`
- `SAMM_CODEBASE_MAPPING.md`
- `SAMM_IMPLEMENTATION_ROADMAP.md`
- `SAMM_FULL_SYSTEM_ARCHITECTURE.md`

## Important Operational Notes
- `ANTHROPIC_API_KEY` already exists in hosted Supabase Edge Function secrets.
- browser parity for Milestone 4 was verified after running Pipeline A from `/samm`
- engine-backed Pipeline A was deployed and matched the previous hosted parity baseline exactly
- Milestone 5A is already complete and pushed
- Milestone 6 is now verified through the real browser app flow for Pipeline B pause/resume
- the next major roadmap slice is Milestone 7 for Pipeline C long-window execution
- the active Milestone 7 checkpoint is only the first CEO campaign-brief human gate
- Milestone 7 first-gate implementation is deployed, but the approval-to-resume handoff is still the active blocker
- if a resumed session breaks mid-build, reread the docs first and verify git state before continuing
- latest hosted Milestone 6 verification: real Inbox approval now reaches `coordinator-chat`, `coordinator-chat` reaches `pipeline-b-weekly`, and Pipeline B resume no longer fails with `401` after the function auth config fix
- Milestone 6 follow-up fixes included removing unsupported `content_registry` column writes from the UI approval path and exposing `draft_approval` rows in Inbox
- the schema slice for Milestone 6 exists in `supabase/migrations/20260409161000_pipeline_runs_status_states.sql` and was applied with `supabase db push`
- unresolved follow-up note: user observed a possible later `samm` behavior bug after the stable resume path was fixed; treat that as a separate investigation, not as part of the completed Milestone 6 gate/resume slice
- the current local environment did not have `deno` installed, so local `deno check` was not available during parity verification
- Milestone 7 resume bug fixed: `resumePipelineRun` in scheduler.ts now queries for `waiting_human` runs directly; commit `a127214`
- supabase CLI is at `C:/Users/Lusa/.scoop/shims/supabase.exe` (not in the bash PATH; use that path directly)

## Constraints To Preserve
- Do not do a broad `samm` workspace redesign yet.
- Do not widen scope into optional-module implementation yet.
- Do not add external API work before the engine-backed execution core is stable.
- Keep the product professional and restrained; avoid overdesigned UI changes.

## Last Known Good Principle
The work has gone well because every slice followed:
- discovery
- diagnosis
- plan
- narrow execution
- verification
- commit

That is the method to continue with.
