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
- planned
- boost suggestion FYI fix already applied (commit in this session)

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
- next slice

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
- next slice

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
- planned

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

Do not include:
- copy rewriting by the model on rejection (that is Milestone 8 refinement)
- changes to the CEO brief gate or Pipeline B

Verification:
- approving all drafts triggers monitor + post-campaign report to run
- rejecting a draft creates a revision item in Inbox and pauses the run
- Operations reflects the correct status throughout

Commit policy:
- one stable commit after the approval-to-resume and rejection-to-pause paths are both verified

## Milestone 8: Onboarding And Capability Templates
Goal:
- make multi-client onboarding a first-class system path

Scope:
- org bootstrap template
- default `org_config`
- default capability flags
- default KPI targets
- default pipeline enablement
- default adapter registrations per plan tier

Verification:
- a new org can be provisioned without manual table surgery
- disabled capabilities stay hidden from runtime suggestions

Commit policy:
- one stable commit for provisioning templates
- separate stable commit for UI onboarding flow if built at the same time

## Milestone 9: Usage Metering And Billing Enforcement
Goal:
- make cost and entitlement boundaries explicit before heavy live API usage

Scope:
- usage attribution by org, pipeline, agent, and tool event
- billing tier gates
- per-tier capability enforcement
- optional run-frequency limits

Verification:
- disabled features cannot be triggered through chat or direct UI routes
- usage records line up with run history

Commit policy:
- one stable commit for metering primitives
- one stable commit for enforcement behavior

## Milestone 10: Live API Swaps Behind Adapters
Goal:
- replace mocks with real providers without changing scheduler or runtime behavior

Scope:
- Facebook Graph API
- WhatsApp Business API
- YouTube Data API
- email provider
- StudyHub metrics feed

Verification:
- adapter failures are surfaced cleanly
- retries are bounded
- state writes remain deterministic
- no scheduler rewrite required

Commit policy:
- one provider family at a time
- never batch all live integrations into one release

## Cross-Cutting Deferred Workstreams
These workstreams must remain visible across milestones.

### Onboarding Flow
Carry through milestones:
- 6
- 8
- 9

Reason:
- capability gating and org provisioning shape runtime behavior early

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
