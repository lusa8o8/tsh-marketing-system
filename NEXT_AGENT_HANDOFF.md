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
- `ae5138c fix: accept scheduler org_id for pipeline b and c`
- `16119f9 docs: add pipeline b and c stability milestones`
- `63fc7a4 docs: update handoff for pipeline b slice`
- `1b9f173 refactor: rebuild pipeline a on shared engine`

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

## Exact Next Slice
### Goal
Add resumable human-gate execution for Pipeline B without widening scope into Pipeline C or broader engine refactors.

### Required workflow
1. Discovery:
   - read the current `pipeline-b-weekly` implementation end to end
   - map fetch, planning, drafting, approval, publish, ambassador update, and reporting phases
   - inspect current Inbox and Content approval actions that touch draft state
   - inspect the scheduler and shared pipeline status contract for pause/resume hooks
2. Diagnosis:
   - state exactly which parts of Pipeline B are still hardcoded
   - separate minimum persisted human-gate requirements from optional future abstractions
3. Plan:
   - define the smallest slice that introduces `waiting_human` and `resumed` behavior while preserving current outputs
4. Edit:
   - keep the first resumable-gate slice narrow and reversible
5. Verify:
   - initial Pipeline B run pauses cleanly in `waiting_human`
   - approval or rejection flows trigger resume through scheduler-backed behavior
   - completed runs exit cleanly to `success` or `cancelled` without breaking Inbox or Content review UX
   - reporting still lands in Inbox
6. Commit stable slice
7. Push if requested

## Why Pipeline B Is Next
- the roadmap and architecture docs define Pipeline B as the first real resumable human-gate workflow
- it already has a natural draft-approval pause point
- it is a smaller resumability problem than Pipeline C
- it exercises the next major architectural boundary after Pipeline A engine conversion and Milestone 5A stabilization

## After This Slice
1. Add long-window resumable execution for Pipeline C.
2. Move to onboarding/capability-template work once the execution core is stable.
3. Add usage metering and billing enforcement.
4. Swap mocked adapters for live provider APIs only after the engine and gate boundaries are stable.

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
- the current active build slice is Milestone 6 for Pipeline B resumable human gates
- if a resumed session breaks mid-build, reread the docs first and verify git state before continuing
- the current local environment did not have `deno` installed, so local `deno check` was not available during parity verification

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
