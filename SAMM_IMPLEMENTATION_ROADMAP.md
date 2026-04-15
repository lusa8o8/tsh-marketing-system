# SAMM Implementation Roadmap

## Purpose
This document translates the target `samm` architecture into an execution roadmap with stable milestones, dependency order, and checkpoint commit expectations.

The goal is to move from the current stabilized runtime toward the full modular agent system without losing reliability, deferred product work, or change discipline.

---

## Test Status

Living record of what has been browser-verified vs pending. Update this when a test is confirmed — do not remove pending items until they pass in the browser.

### Legend
- ✅ Verified in browser
- ⬜ Pending — built and deployed, not yet browser-tested
- 🔲 Not implemented — awaiting milestone

---

### M10 — Editable Calendar + NL Calendar Commands
| Test | Status |
|------|--------|
| Calendar UI — Add event, fill details, save → appears in calendar | ✅ 2026-04-11 |
| Calendar UI — Edit existing event, change name/date → updates in place | ✅ 2026-04-11 |
| Calendar UI — Delete event, confirm → removed from calendar | ✅ 2026-04-11 |
| NL create — "Add a [topic] event on [date]" → event appears in Calendar | ✅ 2026-04-11 |
| NL edit — "Change [event] to [new date]" → DB update executes, calendar reflects change | ✅ 2026-04-11 (fix: needs_confirmation:false) |
| NL delete — "Delete [event]" → confirmation card renders, confirm → event deleted | ✅ 2026-04-11 (fix: response.confirmation + fast-path) |
| NL compound — "Schedule campaign for [event] on [date] and run pipeline" → event created + Pipeline C brief in Inbox | ✅ 2026-04-11 (fix: isCalendarCreateSignal guard) |
| NL scheduler — "Run Pipeline A/B/C" → correct pipeline fires | ✅ 2026-04-11 |
| NL ambiguity — vague event description → samm asks for clarification, does not hallucinate a date | ⬜ |

---

### M11A — Pipeline C Event Context Pass-Through
| Test | Status |
|------|--------|
| Named trigger — "schedule campaign for UNZA graduation on 30 April and run" → brief shows that specific event, not next-in-DB | ✅ 2026-04-11 |
| DB query fallback — "run the campaign pipeline" (no event named) → brief targets next real calendar event | ✅ 2026-04-11 |
| Empty calendar error — "run the campaign pipeline" with no upcoming events → clear error, no demo run | ✅ 2026-04-11 |

---

### M11B — Duration Constraint + Post Scheduling
| Test | Status |
|------|--------|
| Campaign brief shows duration_days of 7–14, not 30–31 | ✅ 2026-04-11 (fix: maxDurationDays clamp) |
| 6 posts land in Content Registry after brief approval | ✅ 2026-04-11 |
| Post scheduled_at timestamps are evenly spread from today → event date - 1 day (not all on trigger day) | ⬜ |

---

### M11C — Accuracy + Registry Polish
| Test | Status |
|------|--------|
| Campaign brief Inbox card shows structured sections with no [object Object] | ✅ 2026-04-11 (fix: structured renderer in inbox.tsx) |
| Campaign brief Inbox card shows competitor_insights_source: 'simulated' label | ⬜ |
| Monitor stage completes without claiming to measure unpublished post performance (status: ready/needs_attention) | ⬜ |

---

### M11D — event_end_date Schema Extension
| Test | Status |
|------|--------|
| Calendar UI Add — "End Date" optional field visible in form | ⬜ |
| Calendar UI Edit — End Date field pre-fills from existing event, saves correctly | ⬜ |
| End Date field only accepts dates on or after the Start Date (min constraint) | ⬜ |

---

### M11E — Brand Visual Kit + Design Brief Injection
| Test | Status |
|------|--------|
| Settings → Visual Brand — fill hex colors, font names, save → reload → values persist | ⬜ |
| Settings → Visual Brand — fill social handles (YouTube, Facebook, WhatsApp), save → reload → values persist | ⬜ |
| Settings → Visual Brand — fill Primary CTA URL, save → reload → value persists | ⬜ |
| Settings → Brand Voice — add approved hashtags, select post format preference, save → persist | ⬜ |
| Run campaign → design brief in Content Registry includes exact hex colors and font names (not hallucinated) | ⬜ |
| Run campaign → design brief includes SOCIAL HANDLES block with exact per-platform values | ⬜ |
| Run campaign → design brief includes QR CODE / PRIMARY CTA LINK line | ⬜ |
| Run campaign → design brief includes exact platform dimensions (1200×628, 1080×1080, etc.) | ⬜ |
| Calendar UI — "Allow creative deviation" toggle visible for graduation/holiday/other event types | ⬜ |
| Calendar UI — toggle hidden (not rendered) for exam and registration event types | ⬜ |
| Run campaign for creative_override_allowed event → design brief includes palette deviation permission note | ⬜ |
| Run campaign → approved hashtags appear in copy assets; no hallucinated alternatives | ⬜ |
| Design brief in Canva AI — completes design without asking for social handles, QR link, or logo location | ⬜ |

---

### M11F — Platform Cadence Policy
| Test | Status |
|------|--------|
| Launch blast — all platforms scheduled on day 0 within preferred_time_utc window | ⬜ |
| Sustaining cadence — no two platforms share the same post day after day 0 | ⬜ |
| Max post cap — no platform exceeds max_posts_per_campaign | ⬜ |
| Post schedule in Inbox card shows staggered timestamps, not uniform sequential times | ⬜ |

---

### M12 — Pipeline D (One-Off Post)
| Test | Status |
|------|--------|
| NL trigger — "Write a post about X" → samm routes to Pipeline D (not Pipeline C) | ⬜ |
| NL trigger — "Draft a WhatsApp message about X" → drafts appear in Content Registry for WhatsApp only | ⬜ |
| Content Registry — drafts land with is_campaign_post: false, status: draft | ⬜ |
| Draft count — correct number of drafts created (1 per requested platform) | ⬜ |
| Brand voice — copy uses brand tone, approved hashtags, and CTA style | ⬜ |
| No pipeline_runs row created (Pipeline D is not tracked in Operations) | ⬜ |

---

## Current Baseline
Already stable and verified:
- `coordinator-chat` scheduler-first handling for Pipeline A status and run requests
- stale `pipeline_runs` expiry
- extracted scheduler module in `coordinator-chat/scheduler.ts`
- normalized pipeline run lifecycle constants shared across runtime code
- agent registry introduced for the current bounded agents used by Pipeline A/B/C
- integration registry introduced for the current mocked channel metadata
- deterministic Pipeline A completion and failure reporting
- Operations overview visibility for pipeline runs
- frontend error normalization for backend function failures
- browser parity verified for the current Pipeline A flow after the integration-registry refactor
- Pipeline A rebuilt on the shared engine and parity-verified against the pre-engine baseline
- Pipeline B invocation restored for scheduler-triggered `org_id` payloads
- Pipeline C invocation restored for scheduler-triggered `org_id` payloads

This is the current foundation. Future work should preserve this behavior.

Current active architectural focus:
- Pipeline B resumable human-gate execution is the next live milestone
- Pipeline C long-window resumable execution follows after Pipeline B is stable
- these slices should build on the now-stable invocation baseline for Pipeline B and Pipeline C

## Roadmap Rules
Every milestone should follow these rules:
- one stable slice at a time
- plan first, implementation second
- commit after every verified stable slice
- do not combine architectural refactors with broad API wiring
- keep deferred product work tracked in the same roadmap
- runtime stability is more important than feature breadth

## Milestone 0: Lock The Current Runtime Baseline
Status:
- complete

Goal:
- preserve the current reliable `samm` and Pipeline A behavior as the baseline for refactors

Outputs:
- stable runtime commits already created
- runtime docs aligned with implementation
- architecture spec written

Checkpoint commits:
- existing completed

## Milestone 1: Extract Scheduler From coordinator-chat
Status:
- complete

Goal:
- move scheduler behavior into a dedicated internal module without changing user-facing behavior

Scope:
- extract stale-run expiry helpers
- extract explicit status request handling
- extract run admission logic
- extract scheduler response formatting
- keep current runtime behavior unchanged

Deliverables:
- scheduler module
- normalized scheduler request/result types
- coordinator-chat simplified to runtime orchestration only

Do not include:
- new external APIs
- new pipelines
- new agent types

Verification:
- Pipeline A status check still reports deterministic live state
- stale running rows still expire correctly
- Operations overview still reflects the same rows

Commit policy:
- one stable commit after behavior parity is verified

## Milestone 2: Normalize Pipeline State Machine
Status:
- complete

Goal:
- establish the shared run lifecycle for all pipelines

Scope:
- define allowed `pipeline_runs.status` values
- introduce `waiting_human`, `resumed`, and `cancelled`
- document transition rules
- update scheduler to use the normalized lifecycle

Deliverables:
- state machine spec in code and docs
- migration or compatibility layer for existing rows
- consistent run transition helpers

Verification:
- Pipeline A still reaches `success` and `failed`
- paused pipelines can be represented without ad hoc status fields

Commit policy:
- one stable commit after state transitions are verified end-to-end

## Milestone 3: Introduce Agent Registry
Status:
- complete

Goal:
- stop hard-coding agent behavior inside pipeline functions

Scope:
- create agent definition contract
- register current bounded agents used by Pipeline A/B/C
- declare allowed tools and required inputs
- keep business behavior stable while changing internal structure

Initial registered agents:
- `classifier`
- `reply_writer`
- `ambassador_checkin_agent`
- `plan_agent`
- `copy_writer_agent`
- `reporting_agent`
- `campaign_planner_agent`

Verification:
- existing pipeline logic still produces equivalent outputs
- agent definitions are inspectable and bounded

Commit policy:
- separate commit for registry introduction before broad pipeline rewrites

## Milestone 4: Introduce Integration Registry
Status:
- complete

Goal:
- isolate platform-specific logic behind adapter capabilities

Scope:
- define capability interfaces
- create adapters for current mocked channels
- route mock platform actions through adapters
- preserve current outputs while changing internal boundaries

Initial adapters:
- `facebook`
- `whatsapp`
- `youtube`
- `email`
- `studyhub`

Future adapters:
- `linkedin`
- `tiktok`

Verification:
- Pipeline A and B still work using mocked adapters
- unsupported capabilities fail predictably

Completed checkpoint:
- registry-backed channel metadata wired into the current pipeline slices
- deployed parity confirmed for Pipeline A
- browser verification confirmed `/samm` run flow and Operations overview remained unchanged

Commit policy:
- one stable commit after adapter parity is confirmed

## Milestone 5: Rebuild Pipeline A On The Engine
Status:
- complete

Goal:
- make Pipeline A the first fully modular declarative pipeline

Why Pipeline A first:
- it already exposed the runtime failure modes
- it has bounded scope
- it mixes loop, parallel, classification, escalation, and state snapshots

Scope:
- express Pipeline A in declarative steps
- move direct business logic behind agents and adapters
- preserve current deterministic behavior
- retain fast completion suitable for edge execution

Verification:
- comments are processed correctly
- escalations land in inbox
- replies/polls land in content state
- metrics snapshot still writes
- run row transitions out of `running`

Completed checkpoint:
- Pipeline A now runs through the shared engine baseline
- hosted parity matched the pre-engine baseline exactly
- browser verification confirmed `/samm` and Operations continued to reflect the same Pipeline A results

Commit policy:
- stable checkpoint commit after production-like verification

## Milestone 5A: Stabilize Pipeline B And C Invocation Baselines
Status:
- complete

Goal:
- restore and verify the current hardcoded Pipeline B and Pipeline C run paths before their larger architectural slices continue

Why this slice exists:
- Pipeline B and Pipeline C were not yet at the same stability level as Pipeline A
- the failure was a narrow invocation-contract issue, not the full resumable-gate implementation
- the next architectural slices should start from a known-good baseline, not from a broken entrypoint

Scope:
- normalize request parsing for scheduler-triggered runs
- accept the current scheduler payload shape consistently
- verify `/samm` and direct invocation can start Pipeline B and Pipeline C without immediate function failure
- keep all existing workflow logic unchanged beyond the invocation contract fix

Verification:
- `coordinator-chat` can trigger Pipeline B without a 500 entrypoint failure
- `coordinator-chat` can trigger Pipeline C without a 500 entrypoint failure
- Operations no longer shows `Never` only because the function crashes before real execution starts

Completed checkpoint:
- Pipeline B now accepts the scheduler-style `org_id` payload
- Pipeline C now accepts the scheduler-style `org_id` payload
- hosted direct invocation verified both pipelines return `ok: true` after deployment
- narrow stability checkpoint committed and pushed before Milestone 6 work

Commit policy:
- one narrow stability commit before Milestone 6 or 7 implementation continues

## Milestone 5B: Enable Real LLM Classification And Reply Generation In Pipeline A
Status:
- deployed, awaiting browser verification

Goal:
- replace the keyword-matching classifier and hardcoded reply templates in Pipeline A with real LLM calls
- the scaffolding (Anthropic client, brand voice, agent registry) is already wired — the LLM is just explicitly discarded with `void anthropic` placeholders

Known stubs to replace:
- `classifyComment`: currently uses keyword matching only; `void anthropic` and `void brandVoice` discard the LLM and brand context entirely
  - bug: spam/complaint keyword ordering — `'scam'` in a spam URL (e.g. `bit.ly/scam123`) triggers the complaint branch before the spam check runs
  - fix: reorder checks (spam before complaint) AND replace with real LLM classification
- `draftReply`: hardcoded template strings; `void anthropic` discards the LLM
  - all complaints get the same "Hi [firstName], I'm really sorry..." string
  - brand voice is ignored; `cta_preference` is only used in the routine template
  - fix: replace with real LLM reply generation using brand voice

What this does NOT fix:
- real comment fetching from live platforms (Facebook, WhatsApp, YouTube APIs) — that is Milestone 10
- Pipeline A will still process the same 7 mock comments until Milestone 10 live API integration
- this milestone only ensures that when comments are processed, the AI is doing real classification and generating real brand-voice replies

Scope:
- enable the Anthropic call inside `classifyComment`
- enable the Anthropic call inside `draftReply`
- fix spam/complaint keyword ordering as part of the classifier rewrite
- keep all routing logic (spam ignored, complaint escalated, boost suggested, routine replied) unchanged

Verification:
- spam comments are correctly ignored without generating a response
- complaint escalations include a real LLM-drafted suggested response
- boost replies reflect actual brand voice
- routine replies are contextually relevant to the question asked

Commit policy:
- one stable commit after parity verification against the mock comment set

Already fixed in this session (separate from full LLM enablement):
- boost suggestion priority changed from `normal` to `fyi` so it shows "Mark read" instead of Approve/Reject
- the reply is already written before the inbox item is created so there is nothing to approve

## Milestone 6: Add Resumable Human Gates For Pipeline B
Status:
- completed and verified through the real app flow
- coordinator-backed resume now works from Inbox approvals
- follow-up bug investigation may still be needed for later `samm` behavior, but the Milestone 6 gate/resume slice itself is stable

Goal:
- make weekly publishing approval flow resumable and state-driven

Scope:
- define `human_gate` step handling
- connect Content review actions to scheduler resume behavior
- surface draft approvals in Inbox instead of hiding them from the primary review surface
- persist draft lifecycle clearly
- keep publisher agent behind approved-content reads only

Verification:
- drafts pause the run
- approval resumes the run
- rejection exits or loops according to policy
- Inbox and Content both expose actionable draft approvals for the waiting run
- coordinator-to-pipeline resume invocations no longer fail on edge auth
- reporting still lands in Inbox

Commit policy:
- one stable commit after full approval-resume flow is verified

## Milestone 7: Add Long-Window Campaign Execution For Pipeline C
Status:
- complete
- first CEO brief gate implemented, deployed, and browser-verified end-to-end
- approval-to-resume handoff confirmed working with real-time UI status updates

Goal:
- support multi-step campaign workflows with multiple human gates and monitoring loops

Scope:
- CEO brief approval gate
- marketer content approval gate
- campaign monitoring loop
- post-campaign closeout
- explicit `waiting_human` and `resumed` transitions

First slice delivered:
- persisted `pipeline_runs` support for Pipeline C
- real `waiting_human` gate after CEO campaign brief creation
- resume path continues only after CEO approval, exits cleanly to `cancelled` on rejection
- fire-and-forget resume via `EdgeRuntime.waitUntil` to avoid 54-second gateway timeout

Verification completed:
- Pipeline C run creates a persisted run row and pauses in `waiting_human` after the campaign brief is created
- the CEO `campaign_brief` is visible and actionable from Inbox
- approval triggers `resume pipeline c` through `coordinator-chat`
- run transitions `waiting_human` → `resumed` → `success` in real time without page refresh
- draft approvals and campaign report land in Inbox after resume
- full browser end-to-end verified on live hosted environment

Fixes committed:
- `a127214`: `resumePipelineRun` now queries `waiting_human` run directly, bypassing the pre-loaded 8-row snapshot
- `c3cd0af`: pipeline resume is now fire-and-forget via `EdgeRuntime.waitUntil`, eliminating the 54-second synchronous timeout

Commit policy:
- stable checkpoint commit after browser verification: complete

## Milestone 7A: Two-Phase Copy Generation For Pipeline C
Status:
- complete
- canonical writer (phase 1) and parallel platform adapters (phase 2) implemented and browser-verified

Goal:
- ensure consistent core messaging across all 6 campaign copy assets before platform adaptation

Why this matters:
- current copy writer fires 6 independent single-shot LLM calls with no shared state
- each call independently interprets `brief.key_message` and `brief.call_to_action`
- results in divergent emphasis, urgency, and phrasing across platforms
- human reviewers are approving 6 assets that may not tell one coherent story

Design:
- Phase 1 (1 sequential call): canonical copy writer
  - inputs: campaign brief, brand voice, event
  - outputs: { headline, core_body, exact_cta, key_fact }
  - this is the verbatim source of truth for the campaign message
- Phase 2 (6 parallel calls): platform adapters
  - inputs: canonical copy + platform-specific instructions
  - each adapter tailors format, length, tone only
  - cannot reinterpret the headline, CTA, or key fact
  - platform-specific fields (subject line for email, bullet points for ambassador WhatsApp) still vary

Scope:
- introduce canonical copy writer step in `resumePipelineCRun`
- pass canonical output as input to all 6 platform adapter calls
- run phase 2 as `Promise.all` instead of sequential `for` loop
- update platform adapter prompts to lock the verbatim core
- keep all downstream DB writes, Inbox inserts, and approval flow unchanged

Benefits:
- message consistency guaranteed across all platforms
- faster resume: parallel phase 2 vs current sequential 6-call loop
- 7 total LLM calls (1 + 6 parallel) instead of 6 sequential

Do not include:
- self-critique or multi-shot refinement loops (deferred to Milestone 8)
- changes to the human approval gate or Inbox flow
- changes to Pipeline A or Pipeline B

Verification:
- all 6 copy assets share the same headline, CTA, and key fact verbatim
- platform-specific formatting still differs correctly per platform
- resume time is visibly faster
- draft approvals still land in Inbox correctly
- Operations run still transitions to `success`

Commit policy:
- one stable commit after browser verification of the two-phase output

## Milestone 7B: Content Registry As The Approval Surface For Copy Assets
Status:
- complete

Goal:
- all content that requires approval lands in Content Registry, not Inbox
- Inbox is reserved for workflow decisions (campaign brief, reports, escalations, suggestions)
- copy assets produced by Pipeline C are reviewed and approved from the Drafts tab in Content Registry

Scope:
- change content_registry insert status from `pending_approval` to `draft`
- remove `human_inbox` draft_approval inserts from the copy asset loop
- remove DEMO MODE auto-approval block
- design brief suggestion remains in Inbox as an FYI to designers (not a content asset)

Verification:
- after Pipeline C resume, Inbox shows only: campaign brief (actioned), design brief suggestion, campaign report
- Content Registry Drafts tab shows 6 copy assets with Approve/Reject buttons
- approving an asset in Content Registry moves it to Scheduled
- no draft_approval items appear in Inbox

Commit policy:
- one stable commit after browser verification

## Milestone 7C: Batch Approval In Content Registry
Status:
- complete
- campaign grouping in Drafts tab and "Approve all" batch action implemented and browser-verified

Goal:
- allow a marketer to approve all drafts from a single campaign in one action
- single-item approve/reject remains unchanged alongside batch

Why:
- 6 drafts from one campaign run are a coherent set — reviewing them individually is friction
- batch should be scoped to one campaign's assets only, not everything on the Drafts tab

Design:
- store `campaign_name` and `pipeline_run_id` on each `content_registry` row at insert time
- group Drafts tab by campaign when campaign assets are present
- each campaign group gets a "Approve all" button that batch-approves only that group
- individual Approve/Reject buttons remain on each card unchanged
- non-campaign drafts (no `pipeline_run_id`) are ungrouped and handled individually as before

Scope:
- backend: add `campaign_name` and `pipeline_run_id` fields to content_registry inserts in pipeline-c-campaign
- frontend: group draft cards by campaign in content.tsx, add batch approve action per group
- api.ts: add `useBatchApproveContent` mutation that approves by `pipeline_run_id`

Do not include:
- batch reject (single rejection should be deliberate)
- changes to Inbox or pipeline resume behavior

Verification:
- 6 campaign drafts appear grouped under the campaign name in the Drafts tab
- "Approve all" button approves all 6 and moves them to Scheduled
- individual Approve/Reject still works on each card
- non-campaign drafts are unaffected

Commit policy:
- one stable commit after browser verification

## Milestone 7D: Marketer Approval Gate For Campaign Copy
Status:
- complete
- approval-to-resume, rejection-to-pause, and inline-edit/resubmit paths all browser-verified end-to-end

Goal:
- make draft approval in Content Registry a real pipeline gate, not a silent action
- rejection should feed back to the pipeline so copy can be revised or the run closed

Design:
- when all drafts from a campaign run are approved: pipeline run moves to the next phase (monitor + report)
- when any draft is rejected: pipeline run returns to `waiting_human` with a revision request in Inbox
- the marketer gate replaces the current silent approve/reject that has no pipeline consequence

Scope:
- track approval state per `pipeline_run_id` in content_registry
- when last draft is approved, trigger pipeline-c-campaign resume for the monitor + report phase
- when a draft is rejected, create a revision inbox item and return the run to `waiting_human`
- keep the current DEMO MODE monitor + report execution — just gate it behind real approval

Delivered:
- Pipeline C stage 2 checks all draft statuses for the run's `pipeline_run_id`
- rejected items pause the pipeline and create a revision request in Inbox
- all approved items resume pipeline → monitor + report → success
- `useEditContent` mutation resets rejected/draft items to `draft`, clears `rejection_note`
- inline edit on draft/rejected Content Registry cards; "Edit & resubmit" label on rejected
- reject reason text input; orange badge for `rejected` status
- `getContentStatusFilter('draft')` includes `rejected` so edited cards appear in Drafts tab
- `toUiContentStatus` no longer maps `rejected` → `failed`
- migration: `rejection_note text` added to `content_registry`

Three verified paths:
1. Approve all drafts → pipeline resumes → monitor + report → success
2. Reject a draft → revision request in Inbox → edit & resubmit in Content Registry → approve → resume → success
3. Inline edit a draft → save → remains draft → approve → resume → success

Commit policy:
- stable commit `49decf2` after browser verification of all three paths

## Milestone 7E: Design Brief To Content Registry + Image Upload + Share
Status:
- complete
- design brief in Content Registry, image upload on copy cards, share dropdown, all browser-verified

Goal:
- move design brief out of Inbox and into Content Registry alongside the campaign copy cards
- harden the Inbox boundary: only workflow gates, reports, escalations, and performance suggestions
- allow marketers to attach images to content cards
- allow design briefs to be shared with designers directly from Content Registry

Why:
- design brief and copy cards currently land in different surfaces (Inbox vs Content Registry) — marketer must context-switch to review them
- co-locating them in Content Registry under the same campaign group enables side-by-side review and keeps alignment visible
- editing copy and the design brief independently across two pages creates misalignment risk
- image upload belongs at draft stage so the marketer approves a complete post (copy + visual) before it is scheduled

Design decisions locked:
- design brief inserts into `content_registry` with `platform: 'design_brief'`, not into `human_inbox`
- design brief card renders differently: Edit + Share (WhatsApp, email, Telegram, clipboard) + Approve (future Canva hook)
- no Approve/Reject on design brief until a design tool integration exists — Approve is the future Canva trigger
- actually: keep Approve on the card as the future Canva hook; share is the current manual path
- design brief is included in the campaign group alongside copy cards (same `pipeline_run_id`)
- image upload is direct browser-to-Supabase-Storage — zero edge function involvement
- `media_url` column added to `content_registry` for image attachment
- image attachable on draft cards (before approval); marketer approves complete post (copy + image)
- Inbox after this slice: campaign brief (CEO gate), reports, performance suggestions, escalations, revision requests, ambassador flags only

Scope:
- `pipeline-c-campaign/index.ts`: change design brief insert from `human_inbox` to `content_registry` with `platform: 'design_brief'`
- migration: add `media_url text` column to `content_registry`
- `content.tsx`: render design brief cards differently (Edit + Share + Approve); image upload on copy cards
- `api.ts`: add `useUploadContentImage` mutation (Storage upload + patch `media_url`)
- share button: static dropdown with WhatsApp / email / Telegram / copy-to-clipboard — no API call

Do not include:
- Canva integration (future milestone)
- linked field propagation between copy cards and design brief (future)
- image upload on design brief cards (brief is text only)

Verification:
- after Pipeline C run, Content Registry Drafts tab shows 6 copy cards + 1 design brief card, all grouped under the campaign
- design brief card shows Edit, Share, and Approve actions; no Approve/Reject pair on copy cards changes
- share dropdown opens with WhatsApp / email / Telegram / clipboard options, pre-populated with brief content
- image can be attached to a draft copy card; thumbnail appears on the card
- approving a copy card with an image attached schedules it correctly
- Inbox no longer receives design brief items after this slice
- all previous Pipeline C flows (CEO gate, marketer gate, rejection loop) still work unchanged

Commit policy:
- one stable commit after browser verification of all paths

## Milestone 8: Multi-Tenant Infrastructure
Status:
- complete
- session-derived org resolution live, sign-in verified
- provision-org edge function deployed
- signup toggle added to login page

Goal:
- make the system genuinely multi-tenant without manual table surgery
- frontend reads org identity from the authenticated session, not a hardcoded constant
- a new org can be provisioned automatically on signup

What is already built:
- Supabase auth (login/signup screen exists, branded as samm)
- `org_config` table with `brand_voice`, `kpi_targets`, `org_name`, `timezone`
- All pipeline DB queries already scope by `org_id` — data isolation is done
- `coordinator-chat` already reads `org_id` from `user.app_metadata?.org_id`

What is missing:
- Frontend `ORG_ID` is a hardcoded constant in `supabase.ts` — every UI query ignores the logged-in user
- No auto-provisioning — creating a second org requires manual SQL inserts
- No default `org_config` template for new orgs

Scope:
- `supabase.ts`: replace hardcoded `ORG_ID` constant with a function that reads `org_id` from the auth session
- all `api.ts` query hooks: use session-derived `org_id` instead of the constant
- edge function or Supabase database trigger: auto-create `org_config` row with sensible defaults when a new user signs up
- default `org_config` template: brand voice placeholder, default KPI targets, all pipelines enabled, all platform adapters registered

Deferred to a later milestone:
- onboarding UI flow (the 4-5 screen wizard collecting brand voice, platforms, KPIs, first calendar event)
- capability flags and sidebar filtering based on business type
- progressive narrowing (ambassador vs affiliate vs UGC distinction)
- usage metering and billing tier enforcement

Onboarding philosophy locked:
- go broad by default — all connectors, agents, and pipelines available to every org
- narrowing comes later via onboarding questions that set capability flags per org
- businesses without ambassadors eventually get capability flags that suppress ambassador copy agents, hide ambassador sidebar items, and skip ambassador pipeline steps
- the agent registry and integration registry already support this — a capability check before an agent runs is a narrow future change

Verification:
- two separate Supabase auth users each see only their own org's data in the UI
- a new signup auto-creates an `org_config` row without manual SQL
- all pipeline runs, inbox items, content, and metrics are correctly scoped to the signed-in user's org

Commit policy:
- one stable commit for the frontend org resolution change
- one stable commit for the auto-provisioning trigger/function

## Milestone 8A: Operations Wiring + Settings Broadening
Status:
- build passes, awaiting browser verification

Goal:
- make Operations Overview and Settings actionable surfaces, not just read-only displays

Delivered:
- Overview: "Run now" button per pipeline (disabled while running/waiting_human); result summary in runs table (comments, replies, escalations, drafts)
- Settings → Integrations: Connect/Disconnect writes to `platform_connections` in `org_config`; switch is live; full integration list — 5 active channels (Facebook, WhatsApp, YouTube, Email, StudyHub) + 5 coming soon (LinkedIn, TikTok, Slack, Teams, Telegram)
- Settings → Pipeline Automation: "Run now" button per pipeline inline with schedule controls
- `api.ts`: `useTriggerPipeline` mutation — calls `coordinator-chat` with `run pipeline x`

Verification checklist:
- Sign in, navigate to Settings → Integrations → Connect Facebook → badge and switch update
- Settings → Pipelines → Run now on Engagement Pipeline → toast + run appears in Overview table
- Overview → Run now on Pipeline A → run starts, result summary shows comments/replies/escalations
- Inbox → complaint escalation has LLM-drafted suggested response (not hardcoded template)

Commit policy:
- committed `e91da84` + fix `ac0909d` — pending browser verification

## Milestone 8B: Onboarding Flow UI
Status:
- deferred — build after Milestone 8 and broad integration coverage

Goal:
- frictionless first-run experience that collects org identity, brand voice, active platforms, KPIs, and first calendar event
- redirect to samm workspace on completion

Scope:
- 4-5 screen wizard on first login
- brand voice form (tone, always/never say, CTA preference, example posts)
- platform selection (full integration list — go broad)
- KPI targets input
- first calendar event seed
- writes to `org_config` and `academic_calendar` on completion

## Milestone 8C: Content Routing Corrections + UX Polish
Status:
- A–E implemented and deployed; extended with F–H post-verification 2026-04-11

Goal:
- close routing gaps and UX friction identified during Milestone 8A browser verification
- all content approvals route through Content Registry; Inbox receives only workflow decisions

Scope and locked plan:

**A — Settings Integrations button** ✓
- Remove the redundant Connect/Disconnect `<Button>` from each integration row; keep only the `<Switch>`

**B — Run now toast timing** ✓
- Fix: wrap `invokePipeline` in `EdgeRuntime.waitUntil`, return `running` status immediately

**C — Pipeline B content routing** ✓
- Remove inbox inserts from pipeline-b-weekly; add `pipeline_run_id` to content_registry inserts
- Update `useActionContent` in `api.ts`: pipeline_runs table lookup for B resume trigger

**D — Content Registry "Comments" tab** ✓
- Add "Comments" tab showing `created_by = pipeline-a-engagement` published items

**E — Spam/complaint classifier** ✓ fixed 2026-04-11
- Root cause: `ref_table` column does not exist on `human_inbox` → complaint insert silently fails; counter increments regardless. Classifier prompt also overly broad after first fix attempt (caught "scam" in text, not just URL).
- Fix E-1: remove `ref_table` from complaint insert; add destructured error check that throws
- Fix E-2: rewrite disambiguation rule — link/URL exception scoped to URL content only; added "personal grievance with THIS org → complaint" rule
- Fix E-3: remove `author.split(' ')[0]` mechanical first-name extraction; instruct LLM to use full name and judge greeting naturally

**F — Intent tags on Comments cards** — locked 2026-04-11
- Diagnosis: `content_registry` has no `metadata` column; intent is not stored after classification
- Fix:
  1. Migration: `ALTER TABLE content_registry ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`
  2. `pipeline-a-engagement`: add `metadata: { intent: classified.intent }` to both routine and boost `content_registry` inserts
  3. `content.tsx`: add `metadata?: Record<string, any> | null` to `ContentItem` type; render intent badge in card header (boost only — amber; routine hidden as noise)

**G — Batch freshness in Comments tab** — locked 2026-04-11
- Diagnosis: date shown without time (`toLocaleDateString()`); no visual grouping by run
- Fix:
  1. Change `toLocaleDateString()` → show date + time (toLocaleString with hour/minute)
  2. Group Comments tab items by `published_at` day (Today / Yesterday / date label) — same batch = same day
  3. Add pulse dot for items published within last 2 hours

**H — Inbox escalation display fix** — locked 2026-04-11
- Diagnosis: `inbox.tsx` line 269 reads `item.payload.original_comment` but pipeline-a inserts as `comment_text`. Items in DB but text never renders.
- Fix: change `item.payload.original_comment` → `item.payload.comment_text ?? item.payload.original_comment`

Do not include:
- changes to Pipeline C or Pipeline A business logic beyond F–H above
- new milestone features

Verification:
- Run Pipeline A → `spam_ignored: 1, escalations: 1` in pipeline_runs result
- Inbox → shows one escalation for "Angry Student"; original comment text visible
- Content Registry Comments tab → each card shows "Boost" amber badge on boost cards; no badge on routine cards
- Comments tab → items grouped by day; items from last 2h have pulse dot; time visible on each card

Commit policy:
- one commit per fix group (E-fixes, F, G, H), each deployed before the next begins

## Milestone 9: Copy Quality Check (Pipeline C Phase 3)
Status:
- planned

Goal:
- add a critic pass after the 6 parallel platform adapters run
- ensures copy is consistent with the canonical message and flags weak output before it reaches the marketer

Scope:
- one LLM critic call that reviews all 6 adapter outputs against the canonical copy
- flags divergence from headline, CTA, or key fact
- optionally revises flagged assets before inserting into content_registry
- keeps the marketer gate unchanged — critic runs before human review, not instead of it

## Milestone 10: Editable Calendar + Natural Language Calendar Commands
Status:
- implemented 2026-04-11, browser verification pending

Goal:
- calendar is fully editable from the UI (add, edit, delete events)
- users can prompt samm to create or update calendar events in natural language
- "schedule a post about the UNZA orientation next Friday" resolves the event from the calendar and queues a Pipeline C run

Scope (all implemented):
- `calendar.tsx`: Edit button per card — prefilled dialog → `useUpdateCalendarEvent` mutation → invalidates calendar query
- `calendar.tsx`: Delete button — AlertDialog confirm → `useDeleteCalendarEvent` mutation → invalidates calendar query
- `api.ts`: `useUpdateCalendarEvent` and `useDeleteCalendarEvent` mutations added
- `coordinator-chat/index.ts`: `create_calendar_event` action type added to model instruction
- `coordinator-chat/index.ts`: handler inserts to `academic_calendar`, optionally fires Pipeline C if model sets `run_pipeline_c: true`

Verification checklist:
- Calendar UI — Add: click "Add Event" (or equivalent), fill in event details, save → event appears in calendar
- Calendar UI — Edit: click Edit on an existing event, change name/date, save → event updates in place
- Calendar UI — Delete: click Delete on an event, confirm → event removed from calendar
- NL create: prompt samm "Add a [topic] event on [date]" → samm inserts event, replies with confirmation, event visible in Calendar
- NL with Pipeline C: prompt samm "Schedule a campaign for [event] on [date] and run the campaign pipeline" → event created AND Pipeline C triggered → campaign brief lands in Inbox
- NL ambiguity: prompt samm with a vague event description → samm asks for clarification rather than hallucinating a date

## Milestone 10 — Verified Status (2026-04-11)

Calendar UI (add/edit/delete), NL calendar commands, Pipeline B end-to-end, and samm NL scheduler commands are all verified. Pipeline C compound intent ("schedule + run") and NL edit both fixed and verified.

Three fixes committed during M10 verification:
- `e6f6e0f`: compound intent bypass (scheduler.ts isCalendarCreateSignal guard) + NL edit needs_confirmation: false
- `3603c50`: academic_calendar event_type constraint widened to include 'graduation' (NOT VALID)
- `508e048`: pipeline taxonomy docs + accurate trigger message for pipeline-c-campaign

Known behavioral note committed to NEXT_AGENT_HANDOFF.md:
- Pipeline C does not receive the specific event as context when triggered — it targets the next due event at runtime. This is a design gap addressed in M11A below.

---

## Milestone 11A: Pipeline C — Event Context Pass-Through
Status:
- complete, browser-verified 2026-04-11
- commit 3879f3a

Also fixed during M11A verification:
- NL calendar delete confirmation never rendered (handler returned response.action, not response.confirmation — chat UI only renders card for the latter)
- Model hallucinated "Deleted X" with action:null when user typed "Confirm" as free text
- Fix (355a063): delete handler returns response.confirmation with action:'calendar_delete:{id}'; fast-path at top of handler executes delete when that prefix is detected in confirmationAction — LLM bypassed entirely

Goal:
- Pipeline C runs for the specific event it was triggered for, not a hardcoded demo event
- standalone "run the campaign pipeline" triggers query the next real upcoming event from academic_calendar, not a hardcoded fallback
- samm surfaces a clear error if no upcoming event exists

Design locked in PIPELINE_C_DESIGN.md. Do not implement without reading that document first.

Scope:
- `coordinator-chat/scheduler.ts`: add `CalendarEventContext` type; `schedulePipelineRun` accepts optional `eventContext` parameter; passes it as `calendarEvent` in the invoke payload
- `coordinator-chat/index.ts`: pass `eventContext` from `action.label/event_date/event_type/universities` when triggering from `create_calendar_event` handler
- `pipeline-c-campaign/index.ts`: replace hardcoded fallback with `getNextCalendarEvent(supabase, orgId, today)` DB query; throw a clear error (not a silent fallback) when no event is found

Do not include:
- campaign duration or scheduling fixes (M11B)
- agent registry changes (M11C)
- event_end_date migration (M11D)

Verification:
- "schedule a campaign for UNZA graduation on 30 April and run the pipeline" → campaign brief in Inbox shows "UNZA graduation" not "UNZA semester 1 exams"
- "run the campaign pipeline" (no event named) → Pipeline C queries DB, targets the next real calendar event, brief shows that event
- "run the campaign pipeline" with no upcoming events in DB → pipeline fails with clear "no upcoming calendar event" message, not a demo run

Commit policy:
- one stable commit after both trigger paths are verified end-to-end

---

## Milestone 11B: Pipeline C — Duration Constraint + Post Scheduling Fix
Status:
- complete 2026-04-11
- browser-verified partial (duration constraint ✅, posts count ✅, scheduled_at spread ⬜ — see Test Status)

Goal:
- campaign duration is bounded by the lead window, not left to the model
- posts are spread across the campaign window, not bunched at trigger time

Scope:
- `runCampaignPlanner`: compute `max_duration = Math.min(days_until_event, 14)` before the LLM call; pass as constraint in the prompt
- `getScheduledTime`: replace index-based offset with even spread across `campaignStart → eventDate - 1 day`

Verification:
- campaign brief shows `duration_days` of 7-14, not 30-31
- 6 posts scheduled at evenly spaced intervals between today and the event date
- post dates visible in Content Registry scheduled_at field

---

## Milestone 11C: Pipeline C — Accuracy + Registry Polish
Status:
- complete 2026-04-11

Goal:
- monitor prompt is honest about what it is actually checking at Stage 3
- competitor researcher is labelled as simulated, not presented as real research
- canonical copy writer appears in the agent registry

Scope:
- `runMonitor` system prompt: reframe as "campaign readiness check" (KPI targets coherent, brand voice complete, event window valid) not "campaign performance check". Real performance monitoring deferred to post-M11 live publishing.
- `runCompetitorResearcher`: add `competitor_insights_source: 'simulated'` to the returned object; include this label in the brief payload so it is visible to the CEO reviewing the brief
- `AGENT_REGISTRY`: add `canonical_copy_writer` entry

Verification:
- campaign brief in Inbox shows a note that competitor insights are simulated
- monitor stage completes without claiming to measure unpublished post performance

---

## Milestone 11D: Pipeline C — event_end_date Schema Extension
Status:
- complete 2026-04-11
- independent of M11A/B/C

Goal:
- academic calendar events can have an end date (for multi-day exam windows, orientation weeks, etc.)
- campaign planner uses the event window for duration and scheduling instead of guessing

Scope:
- migration: `ALTER TABLE academic_calendar ADD COLUMN IF NOT EXISTS event_end_date date;`
- `calendar.tsx` EventForm: add optional "End date" date picker field
- `api.ts` create/update mutations: include `event_end_date` in the payload
- `pipeline-c-campaign/index.ts`: use `event_end_date` in scheduling if present

---

## Milestone 11E: Brand Visual Kit + Design Brief Injection
Status:
- complete 2026-04-11
- must ship before M13 (Live Platform Publishing) — brand inconsistency in published content is a public problem

Goal:
- design briefs contain enough structured visual context that Canva AI (or any design tool) produces brand-consistent output without hallucinating colors, typography, or visual style
- `org_config` gains a `brand_visual` layer equivalent in completeness to the existing `brand_voice` layer
- seasonal/event creative overrides are deliberate and flagged, not accidental

Why now and not later:
- design briefs are already being used in Canva AI (verified by user 2026-04-11)
- Canva AI hallucinates palette, typography, and logo placement on every run because no visual context is injected
- every run until this ships deepens the inconsistency habit
- the fix is text-only (no vision, no file uploads) — small scope, high impact

Scope:

**1. `org_config` schema extension (migration)**
Add `brand_visual` JSONB column with this structure:
```json
{
  "primary_color": "#hex",
  "secondary_color": "#hex",
  "accent_color": "#hex",
  "background_color": "#hex",
  "font_heading": "font name",
  "font_body": "font name",
  "logo_usage_rules": "text — placement, min size, clear space, approved backgrounds",
  "visual_style": "text — flat/photo/illustration, density, whitespace policy",
  "photography_style": "text — real students, natural light, no stock, etc.",
  "layout_preference": "text — mobile-first, key info above fold, etc."
}
```
Add `hashtags` array (approved hashtag list, max 6) and `post_format_preference` string to existing `brand_voice` JSONB.
Add `markdown_design_spec` text column (freeform, injected verbatim into every design brief).

**2. `academic_calendar` schema extension (migration)**
Add `creative_override_allowed` boolean column (default false).
When true, design brief agent relaxes brand constraints with an explicit note.

**3. Settings UI — Visual Brand tab**
New tab in Settings alongside Brand Voice:
- Color pickers / hex inputs for primary, secondary, accent, background
- Font name inputs (heading + body)
- Textarea: Logo usage rules
- Textarea: Visual style direction
- Textarea: Photography style
- Textarea: Layout preferences
- Textarea: Markdown design spec (freeform — injected verbatim)
- Tag input: Approved hashtags

Add to existing Brand Voice form:
- Select: Post format preference (short/medium/long, bullets/prose)
- Textarea: Emoji policy (which, how many, where — not just "ok/not ok")

**4. Calendar UI — creative override toggle**
Add "Allow creative deviation" toggle to the Add/Edit event form.
Visible only on event types where override is relevant (holiday, graduation, other).
exam and registration types lock to false — no override.

**5. `runDesignBriefAgent` — inject brand visual context**
Update system prompt and user message to include:
- Full `brand_visual` object
- `markdown_design_spec` if present (injected verbatim after structured fields)
- Platform dimension specs (static, from integration registry)
- `creative_override_allowed` flag — if true, prompt permits palette deviation within accent color family

**6. `brand_voice` prompts — inject new fields**
Update `buildSystemPrompt` to include hashtag list and post format preference.
Update `runCanonicalCopyWriter` and `runCopyWriter` to receive and apply these constraints.

Platform dimension reference (static, baked into design brief prompt):
- Facebook post: 1200×628 or 1080×1080
- WhatsApp image: 800×800 or 1080×1920 status
- YouTube community: 1080×1080
- Email header: 600×200

Do not include:
- Logo file uploads (requires vision — deferred to M-vision)
- Visual reference image uploads (deferred)
- Canva API integration (deferred)
- Markdown design spec marketplace/community (deferred)

Verification:
- Design brief in Content Registry includes hex colors, font names, logo usage rules, and platform dimensions
- Design brief for a `creative_override_allowed` event includes explicit note permitting palette deviation
- Design brief for an exam event contains no creative override note and full brand constraints
- Settings UI saves brand_visual fields and they persist on reload
- Hashtags in brand_voice appear in copy assets (not hallucinated)

Commit policy:
- migration first (committed before UI or prompt changes)
- one stable commit after Settings UI is verified saving/loading correctly
- one stable commit after design brief injection is verified end-to-end

---

## Milestone 11F: Platform Cadence Policy
Status:
- complete 2026-04-11

Goal:
- post scheduling is governed by a deterministic rule engine, not an LLM agent
- platform-specific day-of-week and time-of-day windows are encoded in the integration registry
- launch blast (day 0, all platforms) is distinguished from sustaining cadence (platform-spaced)
- campaign planners and copy writers can reference the cadence policy without re-deriving it each run

Scope:

**1. Integration registry: add cadence rules per channel**
Each channel entry gains a `cadence_policy` object:
```typescript
cadence_policy: {
  launch_blast: true,          // all platforms fire together on day 0
  sustaining_interval_days: number,  // days between repeat posts on this platform
  preferred_days: string[],    // e.g. ["tuesday", "thursday"]
  preferred_time_utc: string,  // e.g. "08:00"
  max_posts_per_campaign: number
}
```

**2. `pipeline-c-campaign/index.ts`: apply cadence rules in scheduling**
- Day 0 launch posts: schedule all platforms within a ±30 min window at `preferred_time_utc`
- Sustaining posts: next slot = previous slot + `sustaining_interval_days` on a `preferred_days` weekday
- Cap posts per platform at `max_posts_per_campaign`
- Platform sequence for sustaining posts: staggered by 1 day minimum (no two platforms same day after launch)

**3. Remove LLM scheduling decisions**
- Scheduling is not a task for the campaign planner or copy writer
- The campaign planner outputs `post_count_per_platform` intent only
- Actual scheduled times are resolved deterministically after all agents complete

Do not include:
- Dynamic cadence tuning based on engagement data (deferred to post-M13 analytics loop)
- Platform-specific A/B time testing (deferred)
- User-configurable cadence overrides in Settings UI (deferred to M11F+)

Verification:
- Launch blast: all platforms fire on day 0 within their preferred_time_utc window
- WhatsApp post and Facebook post do not share the same sustaining day after day 0
- Max post cap per platform is respected (no platform exceeds its max_posts_per_campaign)
- Post schedule in Inbox card shows correct staggered timestamps, not uniform sequential times

Commit policy:
- integration registry changes first (committed standalone)
- scheduling logic second — committed after Inbox card shows staggered timestamps end-to-end

---

## Milestone 12: One-Off Post Pipeline (Pipeline D)
Status:
- complete 2026-04-11

Goal:
- handle ad-hoc "write a post about X" requests without the full campaign workflow
- no brief, no CEO gate, no research phase, no monitor
- platform drafts → Content Registry → marketer review → done

Scope:
- `supabase/functions/pipeline-d-post/index.ts`: new edge function
  - Accepts: `topic` (required), `platforms` (optional array, defaults all), `event_ref` (optional)
  - 2 LLM call phases: canonical copy writer → parallel platform adapters
  - Inserts drafts into `content_registry` with `is_campaign_post: false`, `status: 'draft'`
  - No `pipeline_runs` row — lightweight utility, not a tracked workflow
  - Completes in < 10 seconds
- `coordinator-chat/scheduler.ts`: add `pipeline-d-post` to `PIPELINE_TARGETS`
- `coordinator-chat/index.ts`:
  - Add `write_post` ActionObject type to model instruction
  - Handler invokes pipeline-d-post in background, returns "drafts will be in Content Registry shortly"
  - Routing guard: "write/draft/create a post/message about X" → write_post action, not run_pipeline

Do not include:
- Research phase, competitor analysis, ambassador data (those are Pipeline C)
- CEO brief gate (Pipeline D goes straight to Content Registry)
- Monitor or post-campaign report
- pipeline_runs row (no tracking — too fast, not a long workflow)

---

## Milestone 12A: Operations Manual Page
Status:
- complete 2026-04-11

Goal:
- give every user a single reference page in the UI covering every question they would otherwise need to answer by scanning the codebase or asking samm
- covers: samm commands, campaign workflow, pipeline reference, content registry, inbox, settings fields, calendar, troubleshooting
- built while context is high — avoids a scan-the-build pass later
- lives under Operations → Manual in the sidebar

Shape decisions locked:
- static accordion page — no API calls, no dynamic data
- 10 sections, each a collapsible accordion item
- rendered at `/operations/manual`
- sidebar subnav extended: Overview / Settings / Manual
- kbd-style command examples for NL prompts
- plain prose for field explanations — not a feature dump, a reference

Sections:
1. Quick Start — what samm is, workspace layout, first-time setup checklist
2. samm Commands — NL examples with copy-safe formatting for every supported action
3. Campaign Workflow (Pipeline C) — step-by-step lifecycle: trigger → brief → CEO approval → copy review → publish
4. One-Off Posts (Pipeline D) — ad-hoc "write a post about X", where drafts land, no gate
5. Content Registry — all statuses explained, tabs, approve/reject/edit/batch
6. Inbox & Approvals — item types (brief, revision, escalation, suggestion, report), how to act on each
7. Academic Calendar — event types, what they affect, creative override toggle explained
8. Settings Reference — every field in Org Details, Brand Voice, Visual Brand, Integrations, Pipeline Automation
9. Pipeline Reference — A (engagement), B (weekly), C (campaign), D (one-off) — what each does, triggers, outputs
10. Troubleshooting — common issues and fixes

Do not include:
- live data or API calls — manual content is static
- onboarding flow logic (separate M8B)

Verification:
- `/operations/manual` loads without errors
- All 10 accordion sections expand/collapse correctly
- Sidebar shows Manual as third subnav item under Operations
- Page is mobile-scrollable (no overflow)

Commit policy:
- one commit after page is wired and all sections render

---

### M12A Test Status
| Test | Status |
|------|--------|
| `/operations/manual` loads without errors | ⬜ |
| All 10 accordion sections expand/collapse | ⬜ |
| Sidebar shows Manual subnav under Operations | ⬜ |
| Page renders correctly on mobile | ⬜ |

---

## Milestone 13: Live Platform Publishing
Status:
- planned
- depends on M11E (brand_visual injected into briefs) and M11F (cadence policy baked in) � both complete
- delivery is split into `M13A` through `M13F`

Goal:
- replace mock publish actions with real platform API calls behind the existing adapter interfaces
- no scheduler or runtime rewrite required � adapters swap mocks for real calls
- drafted + approved content in Content Registry publishes to live platforms on scheduled_at time

Locked delivery rules:
- verification remains one provider family at a time
- `M13A` Facebook is the first end-to-end checkpoint and the first browser/live verification target
- implementation scaffolding for later adapters may be built in parallel to speed production
- parallel scaffolding does not change the stable commit rule: no mixed multi-provider checkpoint commits
- coordinator hardening and platform-compliance work may be split into explicit follow-on slices inside the M13 series

Shared M13 foundation:
- Supabase cron job: poll `content_registry` for rows where `status = 'approved'` or `status = 'scheduled'` and `scheduled_at <= now()` -> publish
- shared publish state contract:
  - on success: update `content_registry.status = 'published'`, set `published_at`
  - on failure: update `status = 'failed'`, log error to `content_registry.metadata`
- shared publisher runner may exist before all adapters are live, but each adapter must be verified independently

### M13A: Facebook Live Publishing
Goal:
- first real end-to-end live publish path

Scope:
- publish approved/scheduled Facebook rows via Facebook Graph API page post publish
- minimal credential path for Facebook in Settings or org config
- scheduled publisher function/runner calls Facebook adapter first for the verified slice

Verification:
- approved Facebook draft publishes to the connected page on schedule
- `published_at` timestamp is set in Content Registry after successful publish
- failed Facebook publish sets `status = 'failed'` with error logged in `metadata`
- no double-publish: cron does not re-process already-published rows

Commit policy:
- migration for publish columns first if still needed
- one stable Facebook checkpoint commit after end-to-end verification

Current implementation/progress snapshot (2026-04-14):
- fresh Honey Shop workspace remains the active `M13A` verification org
- coordinator resilience fix is implemented and deployed
  - transient Anthropic overloads now return a clean retryable `503`
  - raw provider `529` JSON is no longer leaked to the user
- `pipeline-c-campaign` import/resume bug fixed and deployed
  - old failure: `INTEGRATION_REGISTRY is not defined`
- same-day campaign scheduling bug fixed and deployed
  - same-day posts no longer backdate into the past
- frontend org hydration bug fixed locally
  - active session now hydrates `org_id` before org-scoped queries execute
- `publish-scheduled` is now declared in `supabase/config.toml` with `verify_jwt = false` and redeployed
  - anonymous/manual scheduler invocation works again for live verification
- Honey Shop Facebook credentials are now confirmed to reach the backend
  - old `Missing Facebook credentials` error is resolved

Current blocker snapshot (2026-04-14):
- live Facebook publish now reaches the Facebook Graph API and fails with `403 (#200)` permission error
- current blocker is external platform compliance / token scope, not internal scheduler/runtime/config wiring
- next diagnostic target is a Page token with working post-publish permission, then business-verification / official-app readiness if Meta still blocks posting

### M13B: WhatsApp Live Publishing
Goal:
- add WhatsApp Business API publishing after Facebook is stable

Scope:
- WhatsApp Business API send path
- credentials/config for WhatsApp delivery

Verification:
- approved WhatsApp draft/message sends to the configured destination
- success/failure state follows the shared publish state contract

### M13C: YouTube Live Publishing
Goal:
- add YouTube community post publishing after Facebook is stable

Scope:
- YouTube Data API community post path
- required OAuth/token handling for the supported use case

Verification:
- approved YouTube draft publishes successfully
- success/failure state follows the shared publish state contract

### M13D: Email Live Publishing
Goal:
- add email provider publishing after Facebook is stable

Scope:
- SendGrid campaign/send path
- sender + recipient config for email delivery

Verification:
- approved email draft sends successfully
- success/failure state follows the shared publish state contract

### M13E: Coordinator Intent Normalization / Reasoning Hardening
Goal:
- make `samm` more tolerant of small natural-language variations before later chat-channel integrations land

Scope:
- lightweight intent-classification layer before the full coordinator prompt
- normalize common variants and synonyms (`hi`, `hello`, `write`, `draft`, `create campaign`, `run pipeline`)
- reserve the full reasoning path for ambiguous or open-ended requests
- reduce token waste and brittle routing for obvious requests

Verification:
- semantically equivalent greetings and simple pipeline prompts route consistently
- obvious one-off post prompts (`write`, `draft`, `create a post`) resolve to the same intent
- coordinator no longer depends on exact phrasing for simple operational commands

Current implementation/progress snapshot (2026-04-14):
- deterministic greeting handling is working in browser for `hi`, `hello`, `yo`, and similar small variants
- broadened write-post normalization is verified for conversational prompts like `can you draft me a quick post about our grand opening?` and `i need a post about discounts`
- `pipeline-d-post` was fixed and redeployed:
  - stale Anthropic model ids updated to `claude-sonnet-4-20250514`
  - explicit `pipeline-d-post` declaration added to `supabase/config.toml`
- Supabase verification shows:
  - `pipeline-d-post` now returns `200`
  - logs show `4 platform drafts produced` and successful completion into Content Registry
- remaining gap is no longer backend failure; it is product polish:
  - explicit `run pipeline d` alias handling is still missing
  - Operations UI still under-represents Pipeline D because it intentionally creates no `pipeline_runs` row

Next narrow fix:
- add deterministic `run pipeline d` guidance in `coordinator-chat`
- add lightweight Pipeline D last-run visibility in Operations without introducing `pipeline_runs`

### M13F: Platform Compliance + Official App Onboarding Foundation
Goal:
- prepare `samm` to offer production-grade official platform connections instead of ad hoc manual token entry

Scope:
- define the official `samm` Meta app / business owner path
- capture business-verification prerequisites and app-review requirements
- add landing page requirements to the milestone series
- define the future OAuth-based connect flow target for platform connections

Landing page requirements:
- live HTTPS website or subdomain for `samm`
- Privacy Policy
- Terms of Service
- clear product/business description
- contact email
- domain/email consistency where possible

Verification:
- requirements checklist is documented and complete enough to start verification work without rediscovery
- official-app path is explicit in docs and handoff

Current implementation/progress snapshot (2026-04-15):
- first M13F universalization shell is verified in browser:
  - Calendar is now generic (`Event Calendar`, freeform audience tags)
  - Settings uses generic connection wording instead of StudyHub-specific wording
  - optional `Ambassadors` and `Affiliates` toggles are present in Settings
- ambassador module enforcement is partially live and verified:
  - Ambassadors nav hides when disabled
  - direct Ambassadors route redirects when disabled
  - ambassador KPI is hidden when disabled
  - `pipeline-a-engagement`, `pipeline-b-weekly`, and `pipeline-c-campaign` now skip ambassador workflows when the module is off
- `pipeline-b-weekly` universalization fix is verified:
  - hardcoded TSH/StudyHub/UNZA exam-prep mock content removed from the drafting path
  - Honey Shop now receives business-relevant content drafts
  - weekly report no longer includes ambassador status when the module is off
- additional backend universalization already landed:
  - `pipeline-d-post` no longer hardcodes a StudyHub link for Facebook drafts
  - `coordinator-chat` now describes legacy `universities` storage as audience tags / segments
  - `_shared/integration-registry` now labels the old `studyhub` source as `Custom App`
- Pipeline A poll leak was fixed and reverified:
  - old poll leak removed (`undefined`, `Past papers`, `Video walkthroughs`, `Quick revision tips`)
  - Pipeline A now produces generic brand-aware poll copy
- backend enforcement is now partially live; full agent de-registration remains a later pass if needed

Do not include in M13A:
- analytics pull-back from live platforms (separate milestone)
- A/B publish variants
- retry queue (handle in v2)
- one giant multi-provider release

Parallel implementation note:
- adapter scaffolds for M13B/M13C/M13D may be built in parallel while M13A is under active verification
- docs and commit history must still keep Facebook-first as the stable milestone path

---
### M13G: Shared LLM Adapter Foundation
Goal:
- make provider/model selection modular before later chat-channel and multimodel work expands the surface area

Scope:
- add a shared LLM layer under supabase/functions/_shared
- centralize:
  - provider selection
  - model selection
  - retry/backoff handling
  - transient error mapping
  - JSON/text generation helpers
- keep Anthropic as the first live backend
- design the adapter around task-based routing so different features can use different providers/models later

Locked design:
- do not keep adding direct SDK calls in each function
- do not force one global provider for the entire product
- use a shared adapter with task categories such as:
  - coordinator
  - classifier
  - reply_writer
  - weekly_planner
  - weekly_reporter
  - campaign_strategist
  - canonical_copywriter
  - platform_copywriter
  - one_off_writer

Progress:
- pass 1 verified and committed:
  - `_shared/llm-client.ts` added
  - `coordinator-chat` migrated to the shared client
  - greeting handling, deterministic Pipeline D guidance, and transient busy responses remained stable
- pass 2 verified and committed:
  - `pipeline-d-post` migrated to the shared client
  - direct Anthropic instantiation removed from Pipeline D
  - one-off drafting still lands clean Facebook/general drafts in Content Registry
  - Supabase `pipeline-d-post` invocations return `200`
- pass 3 verified and committed:
  - `pipeline-a-engagement` migrated to the shared client for comment classification and reply drafting
  - deployment succeeded and the function returned `200`
  - logs confirm daily poll posting, ambassador gating, and metrics snapshot behavior remained stable
- pass 4 verified and stabilized:
  - `pipeline-b-weekly` migrated to the shared client for:
    - weekly planner
    - weekly copy writer
    - ambassador writer
    - weekly reporter
  - direct Anthropic instantiation removed from Pipeline B
  - deployment succeeded and logs confirm:
    - `Plan created: 9 posts planned`
    - `Running copy writer...`
    - `Sending drafts to Content Registry for approval...`
    - `9 drafts sent to Content Registry`
  - post-approval resume bug was then discovered and fixed:
    - `runReporter(...)` referenced `config` without receiving it
    - verified fix: Pipeline B now resumes cleanly after draft approval
    - logs confirm:
      - `Ambassadors module disabled; skipping ambassador update`
      - `Weekly report sent to human inbox`
- pass 5 verified in browser and Supabase:
  - `pipeline-c-campaign` migrated to the shared client for:
    - performance analyst
    - competitor researcher
    - campaign strategist
    - canonical copywriter
    - platform copywriter
    - design brief writer
    - campaign monitor
    - campaign reporter
  - direct Anthropic instantiation removed from Pipeline C
  - additional runtime fixes were required and are now verified:
    - standalone `run pipeline c` now prechecks for a future event and tells the user to add one first
    - Pipeline C no longer throws a blank `500` when no future event exists
    - resume now persists `calendar_event` before the first human gate, fixing the missing stored context failure
    - coordinator event creation instructions now explicitly forbid inventing campuses or universities when the user did not specify them
  - verified result:
    - campaign brief lands in Inbox
    - approving the brief resumes correctly
    - `6 copy assets landed in Content Registry as drafts ? waiting for marketer approval`

Verified distinction:
- the temporary confusion around a missing discounts draft was not a shared-adapter regression
- the draft did land
- the remaining issue observed is Content Registry visibility polish:
  - no day segmentation on cards
  - no obvious drafted-at freshness on cards

Current shared-client coverage:
- coordinator-chat
- pipeline-d-post
- pipeline-a-engagement
- pipeline-b-weekly
- pipeline-c-campaign

Next narrow move:
- decide whether any remaining direct LLM surface still needs migration
- keep the adapter surface narrow unless a real need appears for shared JSON/helper expansion
- treat Content Registry freshness/day grouping as a separate UI polish, not part of M13G success criteria

---
## Milestone 14: Multi-Channel Samm Access
Status:
- planned

Goal:
- users can talk to samm from Slack, Teams, WhatsApp, Telegram, or email
- samm responds, runs pipelines, and routes approvals through whichever channel the user is in
- the coordinator-chat logic is channel-agnostic — each channel is an input/output adapter

Scope:
- webhook receiver per channel (Slack, Teams, WhatsApp Business API, Telegram Bot API, email inbound)
- normalize incoming message to the coordinator-chat format
- route samm's response back to the originating channel
- image sharing in DMs: user sends an image → samm queues it as a post with platform and scheduling prompt

Architecture note:
- each channel is a plugin in the integration registry — adding a new channel does not touch the core scheduler or pipelines
- approval actions (approve/reject inbox items) routable via channel buttons/reactions where the platform supports it

## Milestone 15: Voice Interface
Status:
- planned

Goal:
- users can speak to samm and receive spoken responses
- highest wow factor — full pipeline delegation via voice

Scope:
- speech-to-text input (Whisper API or browser Web Speech API)
- text-to-speech output for samm responses
- voice-compatible response formatting (no markdown in spoken output)
- available in the samm web UI first, then as a channel adapter for WhatsApp voice notes

## Milestone 16: Dashless Operation + External Tool Integrations
Status:
- planned

Goal:
- samm operates inside the user's existing tools without requiring the samm UI
- reports, content drafts, and campaign results deliverable to Google Sheets, Docs, Excel

Scope:
- Google Sheets / Excel integration: campaign reports written directly to a connected sheet
- Google Docs integration: copy assets drafted into a doc for review
- samm runs entirely via channel access (Slack, Teams, WhatsApp) for users who prefer no additional interface

## Milestone 17: Visual Plugin Builder
Status:
- long-term vision

Goal:
- n8n-style visual interface for connecting integrations, configuring pipelines, and building custom automation flows
- users add "lego" blocks for channels, tools, and pipeline steps without writing code

Scope:
- visual canvas for pipeline configuration
- drag-and-drop connector management
- capability flag management per org from the visual builder
- custom trigger and action definitions

## Milestone 18: Sales and CRM Integration
Status:
- long-term vision, gated by plan tier

Goal:
- samm connected to CRM systems (HubSpot, Salesforce, Pipedrive)
- campaign performance data flows into sales pipeline
- lead attribution from content engagement back to CRM contacts

## Cross-Cutting Deferred Workstreams
These workstreams must remain visible across milestones.

### Cron Scalability
Current crons are per-pipeline, single-org. At ~20-50 active orgs running concurrent pipelines, move to a proper job queue (Inngest, Trigger.dev, or Supabase queuing). Not a Milestone 8 problem — monitor and address when concurrency becomes a real constraint.

### Progressive Onboarding Narrowing
After broad coverage is established, onboarding questions set capability flags that:
- hide irrelevant sidebar items per org
- suppress irrelevant agents in pipeline runs
- skip irrelevant inbox item types
The agent registry and integration registry already support this — it is a narrow future addition, not an architectural change.

### Approval UX
Carry through milestones:
- 6
- 7

Reason:
- resumable human gates are central to reliable automation

### Operations Observability
Carry through milestones:
- 1
- 2
- 5
- 5A
- 7
- 9
- 10

Reason:
- reliability depends on visible run and failure state

### Agent/Integration Extensibility
Carry through milestones:
- 3
- 4
- 5
- 7

Reason:
- new agents and channels must plug into the same architecture, not fork it

## Recommended Immediate Next Slice
Milestones M11A through M11F and M12 are complete. All brand, scheduling, and one-off post infrastructure is in place.

Next highest-leverage work:
1. **M13A Facebook Live Publishing** - active live verification slice. Internal scheduler/runtime/config blockers are largely cleared; the current blocker is Facebook `403 (#200)` permission/compliance, not missing local wiring.
2. **M13E Coordinator intent normalization** - lock the lightweight intent layer before later `samm` chat integrations widen the NL surface area.
3. **M13F Platform compliance foundation** - prepare the official app, business-verification, and landing-page path in parallel with adapter work.
4. **Canva AI close-the-loop test** - run a campaign with brand_visual + social handles filled in Settings and verify Canva AI completes a design without follow-up questions.
5. **Pending test queue** - work through the pending items in the Test Status section above and update each to verified as it passes in the browser.

## Commit Strategy
Recommended commit pattern:
- `docs:` for architecture and roadmap checkpoints
- `refactor:` for behavior-preserving modular extraction
- `feat:` for new state-machine or registry capability
- `fix:` for targeted stability corrections

Checkpoint rule:
- no checkpoint commit until the slice is verified stable
- no broad mixed-purpose commits
- no pushing half-finished architectural rewrites

## Summary
The roadmap is intentionally conservative:
- lock the runtime
- extract scheduler
- normalize run state
- introduce agent and integration registries
- modularize Pipeline A first
- stabilize B and C entrypoints
- add resumable gates for B and C
- bring onboarding, billing, and live APIs in only after the execution core is reliable

That is the boringly effective path to the full agent system.






