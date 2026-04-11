# SAMM Implementation Roadmap

## Purpose
This document translates the target `samm` architecture into an execution roadmap with stable milestones, dependency order, and checkpoint commit expectations.

The goal is to move from the current stabilized runtime toward the full modular agent system without losing reliability, deferred product work, or change discipline.

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
- A–E implemented; E deployed 2026-04-10; browser verification pending

Goal:
- close routing gaps and UX friction identified during Milestone 8A browser verification
- all content approvals route through Content Registry; Inbox receives only workflow decisions

Scope and locked plan:

**A — Settings Integrations button**
- Remove the redundant Connect/Disconnect `<Button>` from each integration row; keep only the `<Switch>`
- The button duplicates the switch and changes label/variant on state change (jarring UX)

**B — Run now toast timing**
- `schedulePipelineRun` in `coordinator-chat/scheduler.ts` awaits full pipeline execution synchronously
- Pipeline A takes ~20-40s (7 LLM calls); Pipeline B takes ~30-60s (plan + copy writer loop)
- Toast fires only after coordinator-chat returns — too late; user has already looked away
- Fix: wrap `invokePipeline` in `EdgeRuntime.waitUntil`, return `running` status immediately
- Coordinator-chat returns in <1s; toast fires promptly; pipeline runs in background

**C — Pipeline B content routing**
- Pipeline B inserts a `draft_approval` item to `human_inbox` per draft (pre-M7B pattern)
- Boundary rule: Inbox = workflow decisions only; Content Registry = all content review
- Fix: remove inbox inserts; add `pipeline_run_id` to content_registry inserts
- Update `useActionContent` in `api.ts`: replace inbox-lookup Pipeline B resume trigger with
  `pipeline_runs` table lookup (same pattern already used for Pipeline C)

**D — Content Registry "Comments" tab**
- Pipeline A engagement replies (routine + boost + polls) land in `content_registry` with
  `status: published`, `created_by: pipeline-a-engagement` — no label or filter separates them
- Add a "Comments" tab showing only `created_by = pipeline-a-engagement` published items
- Add `created_by` filter to `ContentFilter` type and `useListContent` query

**E — Spam misclassification fix** ✓ fixed 2026-04-10
- Root cause confirmed via DB query: `spam_ignored: 0` across all runs; "Spam Account" comment with `bit.ly/scam123` link classified as `complaint` because "scam" in URL triggered complaint heuristic
- Fix: sharpened `classifyComment` system prompt in `pipeline-a-engagement/index.ts` — added explicit disambiguation rule: classify as spam if unsolicited link is present (even if URL contains "scam"); classify as complaint only if a real customer describes a negative experience with THIS org
- Redeploy `pipeline-a-engagement` and verify: `spam_ignored: 1`, `escalations: 1` on next run

Do not include:
- changes to Inbox layout or item types
- changes to Pipeline C or Pipeline A business logic (except E if classification)
- new milestone features

Verification:
- Settings → Integrations: Switch toggles connection, no redundant button
- Run now on any pipeline: toast fires in under 2 seconds
- Pipeline B run: drafts land in Content Registry Drafts tab, not Inbox
- Content Registry: "Comments" tab shows Pipeline A engagement replies
- Inbox: receives Pipeline B weekly report; no draft_approval items

Commit policy:
- one commit per fix (A through E), each deployed before the next begins

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
- planned

Goal:
- calendar is fully editable from the UI (add, edit, delete events)
- users can prompt samm to create or update calendar events in natural language
- "schedule a post about the UNZA orientation next Friday" resolves the event from the calendar and queues a Pipeline C run

Scope:
- editable calendar UI (currently read-only)
- `coordinator-chat` extended to handle calendar create/update commands
- natural language post drafting against a named event: samm reads calendar, generates copy on demand outside of cron schedule
- on-demand Pipeline C trigger from a chat command, not just cron

## Milestone 11: Live Platform Publishing
Status:
- planned (previously Milestone 10)

Goal:
- replace mock publish actions with real platform API calls behind the existing adapter interfaces
- no scheduler or runtime rewrite required — adapters swap mocks for real calls

Scope:
- Facebook Graph API
- WhatsApp Business API
- YouTube Data API
- email provider (SendGrid or equivalent)
- StudyHub metrics feed

Commit policy:
- one provider family at a time — never batch all live integrations into one release

## Milestone 12: Multi-Channel Samm Access
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

## Milestone 13: Voice Interface
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

## Milestone 14: Dashless Operation + External Tool Integrations
Status:
- planned

Goal:
- samm operates inside the user's existing tools without requiring the samm UI
- reports, content drafts, and campaign results deliverable to Google Sheets, Docs, Excel

Scope:
- Google Sheets / Excel integration: campaign reports written directly to a connected sheet
- Google Docs integration: copy assets drafted into a doc for review
- samm runs entirely via channel access (Slack, Teams, WhatsApp) for users who prefer no additional interface

## Milestone 15: Visual Plugin Builder
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

## Milestone 16: Sales and CRM Integration
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
The next concrete implementation slice should be:
1. complete Pipeline B discovery from the stabilized baseline
2. define the smallest persisted `waiting_human` / `resumed` contract for Pipeline B
3. wire Content and Inbox approval actions to scheduler-backed resume behavior
4. verify the run pauses, resumes, and exits cleanly without regressing current content-review UX
5. commit the resumable human-gate slice only after hosted verification

This is now the highest-leverage move because Pipeline A is already engine-backed and parity-verified, and Pipeline B is the first real workflow that exercises persisted human-gate resumability.

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
