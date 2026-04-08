# SAMM Runtime Spec

## Purpose
`samm` is the coordinating runtime for the product, not just a chat endpoint. Its job is to observe workspace state, decide what should happen next, request or execute bounded actions, and report back to the operator in a way that is inspectable and controllable.

The runtime should be boringly effective:
- prefer inspection over guessing
- prefer reversible actions over irreversible ones
- separate reasoning from execution
- keep operator trust higher than novelty
- expose failure honestly

## Runtime Loop
The target `samm` loop is:

1. Receive operator input.
2. Append the input to the active session.
3. Build runtime context from:
   - recent session history
   - workspace memory and configuration
   - enabled capabilities/modules
   - current operational state
4. Ask the coordinator model for the next step.
5. If no tool or action is needed, finish the turn with a direct response.
6. If a tool or action is requested, pass it to the scheduler.
7. Execute only scheduler-approved actions.
8. Append tool results to the session.
9. Re-run the coordinator if another turn is required.
10. Stop when a terminal response or a hard limit is reached.

## Runtime Inputs
Every turn should be able to draw from these inputs:
- operator message
- session history
- workspace identity
- org configuration
- inbox state
- recent pipeline runs
- metrics snapshot
- upcoming trigger events
- capability flags
- prior scheduler results in the same turn

## Runtime Outputs
A runtime turn should produce one of four outcomes:
- direct answer
- clarifying question
- confirmation request
- action result

All operator-facing responses should be structured enough to support UI affordances such as:
- confirmation cards
- suggested follow-up actions
- status notices
- execution summaries

## Layers
The runtime should be split into layers:

### 1. Session Layer
Responsible for:
- storing the current conversation state
- trimming or summarizing older turns
- preserving the minimum context required for continuity

### 2. Context Builder
Responsible for:
- selecting relevant workspace state
- shaping it into a compact prompt payload
- avoiding raw overstuffing of tables or logs

### 3. Coordinator Model
Responsible for:
- deciding whether to answer, ask, confirm, or act
- selecting which tool or workflow should be used next
- staying inside the response contract

### 4. Scheduler
Responsible for:
- validating requested actions
- checking whether confirmation is required
- enforcing hard limits
- executing allowed actions only
- returning structured execution results

### 5. Operator Response Formatter
Responsible for:
- turning the final runtime result into UI-friendly objects
- preserving calm, direct, non-hyped language
- showing failures without hiding them

## Hard Controls
The runtime should always enforce bounded execution.

Recommended controls:
- `maxCoordinatorTurnsPerRequest`
- `maxToolCallsPerTurn`
- `maxSessionMessages`
- `maxContextTokens`
- `maxConsecutiveFailures`
- `requiresConfirmationForMutations`
- `maxPipelineInvocationsPerRequest`

Recommended defaults for the current stage:
- `maxCoordinatorTurnsPerRequest = 3`
- `maxToolCallsPerTurn = 2`
- `maxSessionMessages = 12`
- `maxConsecutiveFailures = 2`
- `requiresConfirmationForMutations = true`
- `maxPipelineInvocationsPerRequest = 1`

## Action Classes
`samm` actions should be grouped by risk.

### Read Actions
Safe by default.
Examples:
- inspect inbox summary
- inspect recent runs
- inspect metrics
- inspect upcoming events

### Soft Mutations
Visible, reversible, or low-risk actions.
Examples:
- draft a plan
- prepare a campaign brief
- queue a recommendation

### Hard Mutations
Anything that can change real operational state or trigger automation.
Examples:
- run a pipeline
- publish content
- send outbound messages
- write to external APIs

Hard mutations should require either:
- explicit operator confirmation
- or a trusted policy that has already been opted into

## Tone and Personality
`samm` should feel:
- calm
- competent
- slightly human
- direct
- non-performative
- not overly chatty

It should not feel:
- robotic
- chirpy
- defensive
- overly anthropomorphic
- magical or vague about what it knows

When asked vague questions, `samm` should still answer naturally, but stay grounded in its role.
Example pattern:
- acknowledge briefly
- answer plainly
- offer useful operational help next

## Failure Behavior
When something fails, `samm` should:
- report the failure clearly
- avoid pretending success
- surface the failing layer when possible
- suggest the next best action

Good failure modes:
- "I could not load recent runs."
- "I could not trigger Pipeline A because the function returned an error."
- "I need confirmation before I run that workflow."

## Capability Awareness
The runtime should be capability-aware.
It must only reason over modules and actions that exist for the workspace.
Examples:
- `ambassadors_enabled`
- `calendar_enabled`
- `partners_enabled`

This prevents `samm` from suggesting workflows that do not apply to the customer.

## Evolution Path
### Current State
- one-shot coordinator chat function
- reads shared state directly
- optional pipeline trigger
- no internal tool loop yet

### Next State
- structured scheduler inside `coordinator-chat`
- clear distinction between read actions and mutation actions
- hard limits enforced per request

### Later State
- dedicated runtime module separate from UI wiring
- memory and context summarization
- richer tool registry
- external API execution through scheduler-approved actions
