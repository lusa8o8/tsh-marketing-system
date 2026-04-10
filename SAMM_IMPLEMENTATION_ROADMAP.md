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
- active
- first CEO brief gate implemented and deployed
- live verification in progress
- current blocker is the approval-to-resume handoff after the Inbox `campaign_brief` action

Goal:
- support multi-step campaign workflows with multiple human gates and monitoring loops

Scope:
- CEO brief approval gate
- marketer content approval gate
- campaign monitoring loop
- post-campaign closeout
- explicit `waiting_human` and `resumed` transitions

Active first slice:
- add persisted `pipeline_runs` support for Pipeline C
- replace demo auto-approval of the CEO campaign brief with a real `waiting_human` gate
- add a resume path that continues only after CEO approval or exits cleanly on rejection
- keep the first slice narrow and do not yet widen into the marketer draft-approval gate or the monitoring loop resume model

Why this first:
- it establishes the real long-window execution boundary for Pipeline C
- it reuses the proven Milestone 6 persisted human-gate pattern from Pipeline B
- it avoids batching both human gates and the monitoring loop into one risky checkpoint

Verification:
- initial Pipeline C run creates a persisted run row and pauses in `waiting_human` after the campaign brief is created
- the CEO campaign brief is visible and actionable from Inbox
- resume through scheduler-backed behavior moves the run forward only when the brief is approved
- rejection exits the run cleanly to `cancelled`
- a campaign can pause and resume across sessions
- monitoring alerts land in Inbox
- post-campaign report completes and closes the workflow cleanly

Current verified state:
- direct hosted invocation of `pipeline-c-campaign` returns `ok: true` with `waiting_human: true`
- Operations shows the latest Pipeline C run in `waiting_human`
- the CEO `campaign_brief` lands in Inbox correctly
- Inbox approval triggers `resume pipeline c` through `coordinator-chat`
- the scheduler `resumePipelineRun` bug has been fixed (`a127214`): it now queries for the `waiting_human` run directly rather than relying on the pre-loaded 8-row snapshot
- end-to-end browser verification of the full approval-to-resume flow is the remaining open step before Milestone 7 first gate is fully closed

Commit policy:
- break this into multiple stable commits, not one large merge

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
