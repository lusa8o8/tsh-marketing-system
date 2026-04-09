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

This is the current foundation. Future work should preserve this behavior.

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

Commit policy:
- stable checkpoint commit after production-like verification

## Milestone 6: Add Resumable Human Gates For Pipeline B
Goal:
- make weekly publishing approval flow resumable and state-driven

Scope:
- define `human_gate` step handling
- connect Content review actions to scheduler resume behavior
- persist draft lifecycle clearly
- keep publisher agent behind approved-content reads only

Verification:
- drafts pause the run
- approval resumes the run
- rejection exits or loops according to policy
- reporting still lands in Inbox

Commit policy:
- one stable commit after full approval-resume flow is verified

## Milestone 7: Add Long-Window Campaign Execution For Pipeline C
Goal:
- support multi-step campaign workflows with multiple human gates and monitoring loops

Scope:
- CEO brief approval gate
- marketer content approval gate
- campaign monitoring loop
- post-campaign closeout
- explicit `waiting_human` and `resumed` transitions

Verification:
- a campaign can pause and resume across sessions
- monitoring alerts land in Inbox
- post-campaign report completes and closes the workflow cleanly

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
1. do discovery on the current Pipeline A function and map it into the target engine shape
2. define the minimum declarative step contract needed for Pipeline A only
3. rebuild Pipeline A on the engine while preserving exact current behavior
4. verify parity for comments, escalations, replies, poll creation, metrics snapshot, and run completion
5. commit the engine-backed Pipeline A slice only after production-like verification

This is now the highest-leverage move because Milestones 1-4 are complete and Pipeline A is the first bounded workflow that exercises the engine shape without the resumable-human-gate complexity of Pipeline B or C.

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
- add resumable gates for B and C
- bring onboarding, billing, and live APIs in only after the execution core is reliable

That is the boringly effective path to the full agent system.
