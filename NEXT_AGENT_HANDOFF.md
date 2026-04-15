# Next Agent Handoff

## Repo
- Root: `C:\Users\Lusa\tsh-marketing-system`
- Main app: `C:\Users\Lusa\tsh-marketing-system\M.A.S UI`
- Supabase project ref: `jxmdwltfkxstiwnwwiuf`
- GitHub repo: `https://github.com/lusa8o8/tsh-marketing-system.git`

## Working Discipline
Carry this forward exactly.

1. Do discovery first. Read before editing.
2. State diagnosis explicitly before proposing a fix.
3. Lock a plan in the docs before writing any code.
4. Keep changes narrow and reversible.
5. Commit every stable slice with a descriptive message.
6. Push stable checkpoints to `main` when requested.
7. Avoid speculative cleanup or scope creep.

The product has stayed clean because every session followed: discovery -> diagnosis -> plan -> narrow execution -> verification -> commit.

## If The Session Breaks Or Rate Limits Hit
Before touching code, reread:
- `NEXT_AGENT_HANDOFF.md`
- `SAMM_IMPLEMENTATION_ROADMAP.md`
- `SAMM_FULL_SYSTEM_ARCHITECTURE.md`
- `SAMM_RUNTIME_SPEC.md`
- `SAMM_SCHEDULER_CONTRACT.md`
- `SAMM_CODEBASE_MAPPING.md`

## Current Build Status
Stable through `M11A-M12A` on `main`.

Do not trust the old handoff text that said the repo was only stable through `M10 + 8C`.
Current source of truth is:
- `SAMM_IMPLEMENTATION_ROADMAP.md` for milestone and browser-test status
- `git log` for what has actually landed
- this file for institutional memory and next-slice guidance

### Latest commits
- `e657361` - docs(manual): replace all technical copy with plain language
- `d93cdb1` - feat(M12A): add Operations Manual page
- `6fd4e80` - M12: Pipeline D one-off post + docs - duplicate milestones fixed, tests tracked
- `afc5e3c` - M11F: Platform cadence policy - deterministic post scheduling
- `d50e937` - docs: add Test Status tracker - verified vs pending across M10-M11F
- `0e33bd2` - M11E+: social handles, CTA URL, logo note - close Canva AI brief gaps
- `32b4ef3` - docs: mark M11E complete in roadmap
- `319e90b` - M11E: brand visual kit - design brief injection, Settings UI, creative override
- `13bdf01` - M11C + M11D: Pipeline C accuracy, registry polish, event_end_date
- `c89cee8` - fix: campaign duration units + inbox brief card rendering
- `97daa37` - feat(M11B): campaign duration constraint + post scheduling spread
- `4d6a655` - docs: M11A verified complete + confirmation card pattern institutional memory

All pushed to `main`.

## Product State
`samm` is still the product anchor. Hybrid control-plane model remains the intended architecture.

Current stance:
- Full workspace redesign is deferred.
- UI changes stay narrow and operational.
- Inbox = workflow decisions only.
- Content Registry = content review only.
- Optional modules stay deferred until capability gating/onboarding work.

## Institutional Memory

### Supabase JS insert error pattern
`supabase.from(...).insert({...})` does not throw on failure; it returns `{ data, error }`.
Rule: always destructure and handle `error` explicitly.

### Claude Haiku markdown fence behavior
Haiku wraps JSON in fenced blocks even when told not to.
Rule: strip fences before `JSON.parse` with the existing regex pattern.

### `ref_table` is not a column on `human_inbox`
Do not add it back.

### Pipeline C event context is fixed now
`M11A` landed.
- NL calendar create + run passes `calendarEvent` through `coordinator-chat/scheduler.ts`
- Standalone `run the campaign pipeline` falls back to the next upcoming `academic_calendar` event
- Empty calendar fails clearly instead of running a demo event
Do not reintroduce the old hardcoded demo fallback.

### `academic_calendar.event_type` needs migrations when widened
If the UI adds a new event type, add a migration to widen the DB constraint in the same slice.

### NL edit needs `needs_confirmation: false`
Edits are reversible and should execute directly. Deletes still require confirmation.

### Confirmation card pattern
The chat UI renders confirmation cards only from `response.confirmation`, not `response.action`.
For destructive actions that need confirmation, use a deterministic `confirmation.action` token and a fast-path handler.

### Scheduler interception note
Messages with a pipeline keyword plus a run verb can bypass the LLM and go straight through scheduler handling.
Keep `isCalendarCreateSignal`-style guards when a message must create state before triggering a pipeline.

## Remaining Verification Queue
Use `SAMM_IMPLEMENTATION_ROADMAP.md` as the detailed checklist. Current pending browser checks still visible in the roadmap include:
- `M10`: NL ambiguity should ask for clarification instead of hallucinating a date
- `M11B`: verify `scheduled_at` timestamps are visibly spread across the campaign window
- `M11C`: verify competitor label is shown as simulated and monitor language stays honest
- `M11D`: verify end date add/edit/min constraint behavior in Calendar UI
- `M11E`: verify visual brand persistence, design brief injection, and creative override note
- `M11F`: verify launch blast, stagger, per-platform cap, and staggered timestamps
- `M12`: verify Pipeline D routing, draft creation, brand voice behavior, and no `pipeline_runs` row
- `M12A`: verify manual page load, accordion behavior, sidebar link, and mobile rendering

## Milestone Queue
- `M13A`: Facebook Live Publishing - active live verification slice
  - Facebook remains the first end-to-end verified slice
  - On success write `content_registry.status = 'published'` and `published_at`
  - On failure set `status = 'failed'` and log the reason in `metadata`
- `M13B`: WhatsApp live publishing
- `M13C`: YouTube live publishing
- `M13D`: Email live publishing
- `M13E`: Coordinator intent normalization / reasoning hardening
  - add a lightweight intent-classification layer before the full coordinator prompt
  - normalize small NL variants (`hi`, `hello`, `write`, `draft`, `create campaign`, `run pipeline`)
  - prepare `samm` for later chat-channel integrations
- `M13F`: Platform compliance + official app onboarding foundation
  - official `samm` Meta app / business-verification track
  - landing page + policy docs + domain/email consistency for platform review
- parallel scaffolding for `M13B/M13C/M13D` is allowed, but verification and stable commits remain provider-by-provider
- `M14`: Multi-channel samm access
- `M15`: Voice interface
- `M16`: Dashless operation
- `M-vision`: logo upload, multimodal palette extraction, visual references, Canva API integration

## Pipeline Taxonomy
| Pipeline | Intent | Output | Approval gates | When to use |
|---|---|---|---|---|
| A - Engagement | Process social comments | Replies in Content Registry; escalations + boost suggestions in Inbox | None | Comment processing |
| B - Weekly Content | Generate weekly content batch | Draft posts in Content Registry | Marketer gate | Weekly cadence |
| C - Campaign | Full campaign for an event | Brief in Inbox; 6 copy cards + design brief in Content Registry | CEO brief + marketer copy gates | Major event campaigns |
| D - One-Off Post | Draft ad-hoc posts on request | 1-N platform drafts in Content Registry | Marketer review only | "Write a post about X" |

Rule of thumb:
- "Run a campaign" or "schedule a campaign for X" -> Pipeline C
- "Write a post" or "draft a WhatsApp message about X" -> Pipeline D

## Key Files

### Frontend
- `M.A.S UI/src/pages/content.tsx`
- `M.A.S UI/src/pages/inbox.tsx`
- `M.A.S UI/src/pages/agent/overview.tsx`
- `M.A.S UI/src/pages/agent/settings.tsx`
- `M.A.S UI/src/pages/agent/manual.tsx`
- `M.A.S UI/src/lib/api.ts`
- `M.A.S UI/src/lib/supabase.ts`

### Supabase edge functions
- `supabase/functions/pipeline-a-engagement/index.ts`
- `supabase/functions/pipeline-b-weekly/index.ts`
- `supabase/functions/pipeline-c-campaign/index.ts`
- `supabase/functions/pipeline-d-post/index.ts`
- `supabase/functions/coordinator-chat/index.ts`
- `supabase/functions/coordinator-chat/scheduler.ts`
- `supabase/functions/_shared/pipeline-engine.ts`
- `supabase/functions/_shared/agent-registry.ts`
- `supabase/functions/_shared/integration-registry.ts`
- `supabase/functions/_shared/pipeline-run-status.ts`
- `supabase/functions/provision-org/index.ts`

### Key migrations already landed
- `20260409161000_pipeline_runs_status_states.sql`
- `20260410120000_content_registry_campaign_fields.sql`
- `20260410130000_content_registry_rejection_note.sql`
- `20260410140000_content_registry_media_url.sql`
- `20260410150000_content_registry_design_brief_platform.sql`
- `20260411100000_org_config_extended_fields.sql`
- `20260411110000_content_registry_metadata.sql`
- `20260411120000_academic_calendar_event_type_graduation.sql`

## Operational Notes
- `ANTHROPIC_API_KEY` is already set in hosted Supabase Edge Function secrets
- Supabase CLI: `C:/Users/Lusa/.scoop/shims/supabase.exe`
- Local `deno` is not installed; deploy to verify Deno-side changes
- `content_registry` lifecycle: `draft -> scheduled -> published` or `rejected` or `failed`
- `pipeline_runs` lifecycle: `running -> waiting_human -> resumed -> success/failed/cancelled`
- Pipeline C resumes in the background via `EdgeRuntime.waitUntil`

## Current M13A State
- Fresh Honey Shop workspace/org remains the active `M13A` verification org.
- `coordinator-chat` overload handling was hardened and deployed.
  - raw Anthropic `529 overloaded_error` is no longer leaked to the user
  - transient model failures now return a clean retryable `503` message
- `pipeline-c-campaign` resume/import bug was fixed and deployed.
  - old failure: `INTEGRATION_REGISTRY is not defined`
- same-day campaign scheduling was fixed and deployed.
  - posts no longer backdate into the past for same-day events
- frontend org hydration bug was fixed locally.
  - `getOrgId()` now hydrates from the active session before org-scoped queries run
  - this prevented Honey Shop Settings saves from silently targeting the wrong org on fresh load
- `publish-scheduled` is now declared in `supabase/config.toml` with `verify_jwt = false` and redeployed.
  - anonymous/manual scheduler invocation works again for live verification
- Honey Shop Facebook credentials are now confirmed to reach the backend.
  - the old `Missing Facebook credentials` error is resolved

## Current Blocker
- `M13A` is no longer blocked by local scheduler/runtime/config wiring.
- Live Facebook publish now reaches the Facebook Graph API and fails with permission error `403 (#200)`.
- Current blocker is external platform compliance / token scope, not internal app logic.
- The Honey Shop app/token path still needs a Page token with working post-publish permission.
- Meta may require the official app/use-case path and possibly business verification for production-grade page publishing.

## Current M13E Diagnosis
- The deterministic greeting layer is working in browser for `hi`, `hello`, `yo`, and similar small variants.
- The broadened write-post matcher is now verified for conversational one-off prompts like:
  - `can you draft me a quick post about our grand opening?`
  - `i need a post about discounts`
- `pipeline-d-post` was fixed and redeployed:
  - stale Anthropic model ids were updated to `claude-sonnet-4-20250514`
  - `pipeline-d-post` was added to `supabase/config.toml`
- Browser + Supabase verification now shows:
  - `coordinator-chat` returns deterministic Pipeline D responses for conversational one-off post prompts
  - `pipeline-d-post` returns `200`
  - Supabase logs show `4 platform drafts produced` and `Pipeline D complete: 4 drafts in Content Registry`
  - Honey Shop Content Registry is populated with the resulting drafts
- Remaining M13E follow-up is narrower than the original blocker:
  - Operations UI is still mostly driven by `pipeline_runs`, so Pipeline D remains under-visible in the app because it intentionally creates no `pipeline_runs` row
  - explicit command alias handling for `run pipeline d` is still missing, so that phrasing can still fall through to the LLM path instead of returning a deterministic guided response
- Next narrow fix: add deterministic `run pipeline d` guidance and lightweight Pipeline D last-run visibility in Operations without introducing `pipeline_runs` for Pipeline D.

## Current M13F Diagnosis
- `M13F` is now in active universalization/modularity work, not just compliance planning.
- Verified M13F progress so far:
  - Calendar UI is now generic (`Event Calendar`, freeform audience tags instead of fixed university chips).
  - Settings now uses generic wording (`Connections & Modules`, `Custom App / Private Tool`, `Product / Landing Page`).
  - Optional module toggles exist in Settings for `Ambassadors` and `Affiliates`.
  - `Ambassadors` now behaves like a real optional module in the product shell:
    - hidden from nav when disabled
    - direct `/ambassadors` route redirects to Settings when disabled
    - ambassador KPI field is hidden when disabled
  - backend ambassador enforcement is partially live:
    - `pipeline-a-engagement`, `pipeline-b-weekly`, and `pipeline-c-campaign` now skip ambassador workflows when the module is off
  - `pipeline-b-weekly` hardcoded TSH/StudyHub mock content has been replaced with generic org-aware fallback content
  - `pipeline-b-weekly` weekly report no longer includes ambassador status when the module is off
  - `pipeline-d-post` Facebook drafting no longer hardcodes a StudyHub link
  - `coordinator-chat` calendar instructions now treat the legacy `universities` field as generic audience tags / segments
  - `_shared/integration-registry` now exposes the old `studyhub` source as generic `Custom App` wording
- Browser/runtime verification completed in Honey Shop:
  - Ambassadors toggle off: nav hidden, route gated, KPI hidden, no ambassador-targeted generation triggered
  - Pipeline B now drafts Honey Shop-relevant content instead of UNZA/StudyHub exam-prep content
  - Pipeline D remains clean after universalization changes
- Remaining M13F runtime leak was fixed and reverified:
  - Pipeline A no longer emits the old education-era poll options or `undefined` brand fallback
  - verified replacement: `What would you like to see more of from this brand this week? A) Product tips B) Behind-the-scenes updates C) Special offers`
- M13F is now stable enough to hand off as a committed universalization checkpoint
## Current M13G Diagnosis`r`n- `M13G` pass 1 is complete and committed.`r`n  - `_shared/llm-client.ts` exists`r`n  - `coordinator-chat` now uses the shared Anthropic-backed client`r`n- `M13G` pass 2 is verified and committed.`r`n  - `pipeline-d-post` now uses the shared client for canonical copy and platform copy generation`r`n  - direct Anthropic instantiation was removed from Pipeline D`r`n  - one-off prompts still return clean deterministic responses`r`n  - Supabase `pipeline-d-post` invocations return `200``r`n  - resulting drafts land in Content Registry`r`n- `M13G` pass 3 is now verified in browser and Supabase.`r`n  - `pipeline-a-engagement` now uses the shared client for comment classification and reply drafting`r`n  - deployment succeeded and the function returned `200``r`n  - logs confirm:`r`n    - daily poll still posts clean generic copy`r`n    - ambassador gating still works when disabled`r`n    - daily metrics snapshot still writes`r`n  - no new runtime error surfaced in the migration`r`n- Remaining non-adapter issue observed during the series:`r`n  - Content Registry still lacks day segmentation / obvious drafted-at freshness on cards`r`n  - this is a separate UI polish, not an adapter blocker`r`n- Locked next move:`r`n  - commit `M13G` pass 3 as a successful shared-adapter migration`r`n  - if the adapter series continues, migrate `pipeline-b-weekly` next before broadening the shared interface further`r`n`r`n## Landing Page / Compliance Note
- Add landing page requirements to the `M13` series as part of `M13F`.
- Minimum assets to prepare:
  - live HTTPS website or subdomain for `samm`
  - Privacy Policy
  - Terms of Service
  - product/business description
  - contact email
  - domain/email consistency where possible
- A subdomain is acceptable for early setup, but if the final `samm` domain is known, buy it early to reduce rework during verification.

## Constraints To Preserve
- Do not do a broad `samm` workspace redesign.
- Keep the product professional and restrained.
- Keep scope narrow and milestone-shaped.
- For `M13A-M13D`, keep stable checkpoints provider-by-provider. Parallel scaffolding is allowed, but do not collapse Facebook, WhatsApp, YouTube, and email into one unverified commit.





