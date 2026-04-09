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

### Architecture Docs
Committed and pushed:
- `SAMM_RUNTIME_SPEC.md`
- `SAMM_SCHEDULER_CONTRACT.md`
- `SAMM_CODEBASE_MAPPING.md`
- `SAMM_IMPLEMENTATION_ROADMAP.md`

## Latest Important Commits
- `e84703a feat: add integration registry parity slice`
- `04db3ee Add coordinator chat orchestration slice`
- `4442e36 Add samm runtime architecture specs`

These are already pushed to `main`.

## Current Status
The current runtime is stable at the Milestone 4 boundary.

Verified:
- `/samm` can run Pipeline A successfully
- inbox and Operations overview reflect the latest Pipeline A output
- integration-registry wiring did not change the current Pipeline A behavior

There is no active runtime blocker at the moment.

## Exact Next Slice
### Goal
Prepare the rebuild of Pipeline A onto the target engine shape without changing behavior.

### Required workflow
1. Discovery:
   - read the current `pipeline-a-engagement` implementation end to end
   - map its current loop, parallel work, writes, and run-state handling
   - identify the minimum engine contract needed for Pipeline A only
2. Diagnosis:
   - state exactly which parts of Pipeline A are still hardcoded
   - separate engine requirements from optional future abstractions
3. Plan:
   - define the smallest engine-backed slice that preserves exact outputs
4. Edit:
   - keep the first engine slice narrow and reversible
5. Verify:
   - confirm comments, escalations, replies, poll posts, metrics snapshot, and run status remain unchanged
   - confirm `/samm` and Operations still reflect the same Pipeline A outcomes
6. Commit stable slice
7. Push if requested

## Why Pipeline A Next
- it already exposed the runtime failure modes earlier in the project
- it has bounded scope
- it includes loop, parallel, classification, escalation, content writes, metric snapshotting, and run completion
- it is the smallest real workflow that exercises the target engine model

## Relevant Files
### Frontend
- `M.A.S UI/src/pages/agent/chat.tsx`
- `M.A.S UI/src/lib/api.ts`
- `M.A.S UI/src/lib/supabase.ts`

### Supabase
- `supabase/functions/pipeline-a-engagement/index.ts`
- `supabase/functions/coordinator-chat/index.ts`
- `supabase/functions/coordinator-chat/deno.json`
- `supabase/functions/coordinator-chat/scheduler.ts`
- `supabase/functions/_shared/agent-registry.ts`
- `supabase/functions/_shared/integration-registry.ts`
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
- Operations overview showed the expected success row and summary after the run
- the current local environment did not have `deno` installed, so local `deno check` was not available during parity verification

## Medium-Term Next Slices After Pipeline A Engine Discovery
In order:
1. Rebuild Pipeline A on the engine with parity preserved.
2. Add resumable human-gate execution for Pipeline B.
3. Add long-window resumable execution for Pipeline C.
4. Move to onboarding/capability-template work once the execution core is stable.
5. Swap mocked adapters for live provider APIs only after the engine boundary is stable.

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
