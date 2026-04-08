# SAMM Scheduler Contract

## Purpose
The scheduler is the execution gate between model output and real system behavior.
It exists so the coordinator can propose actions without having direct unchecked authority to perform them.

## Principle
The model may propose. The scheduler decides.

## Inputs
The scheduler receives a structured action request from the coordinator model.

Base shape:

```json
{
  "type": "run_pipeline",
  "target": "pipeline-a-engagement",
  "needs_confirmation": true,
  "title": "Run Pipeline A - Engagement",
  "description": "This will process the latest engagement queue and flag escalations."
}
```

The scheduler also receives runtime metadata:
- org id
- operator id
- current request id
- current turn count
- actions already executed in this request
- capability flags
- current confirmation context

## Responsibilities
The scheduler must:
- validate action shape
- validate target against allowed actions
- check capability availability
- check whether confirmation is required
- enforce hard limits
- execute only allowed actions
- normalize execution results
- return structured success or failure

## Action Categories

### Read
No confirmation required unless policy says otherwise.
Examples:
- `get_inbox_state`
- `get_recent_runs`
- `get_metrics_snapshot`
- `get_upcoming_events`

### Mutating Internal Actions
May require confirmation depending on risk.
Examples:
- `run_pipeline_a`
- `run_pipeline_b`
- `run_pipeline_c`
- `run_coordinator`

### External Mutations
High-trust only. Should require confirmation or policy allow-listing.
Examples:
- publish content
- send message
- call Facebook API
- call WhatsApp API
- call YouTube API

## Validation Rules
The scheduler must reject actions when:
- the action type is unknown
- the target is unknown
- the target is not enabled for the workspace
- the request exceeds hard limits
- confirmation is required but not present
- prior failures exceeded the threshold

## Confirmation Rules
Mutations should require explicit confirmation by default.

Current confirmation contract:
- coordinator proposes mutation
- scheduler marks it as `awaiting_confirmation`
- UI renders confirmation card
- operator confirms
- scheduler executes on the follow-up turn

Suggested follow-up payload:

```json
{
  "message": "Confirm Run Pipeline A - Engagement",
  "confirmationAction": "pipeline-a-engagement"
}
```

## Execution Result Shape
The scheduler should always return a normalized result.

Success:

```json
{
  "ok": true,
  "status": "queued",
  "action": {
    "type": "run_pipeline",
    "target": "pipeline-a-engagement"
  },
  "result": {
    "pipeline": "pipeline-a-engagement"
  }
}
```

Failure:

```json
{
  "ok": false,
  "status": "failed",
  "action": {
    "type": "run_pipeline",
    "target": "pipeline-a-engagement"
  },
  "error": {
    "code": "invocation_failed",
    "message": "Failed to invoke pipeline-a-engagement"
  }
}
```

## Current Minimum Scheduler for This Repo
The immediate scheduler contract for this codebase should support:
- `run_pipeline` -> `pipeline-a-engagement`
- `run_pipeline` -> `pipeline-b-weekly`
- `run_pipeline` -> `pipeline-c-campaign`
- `run_pipeline` -> `coordinator`

It should also support read-only internal actions later without changing the outer contract.

## Suggested Internal Interface
```ts
interface SchedulerRequest {
  type: 'run_pipeline' | 'read_state'
  target: string
  needsConfirmation?: boolean
  title?: string
  description?: string
}

interface SchedulerContext {
  orgId: string
  userId: string
  turnCount: number
  actionsExecuted: number
  capabilityFlags: Record<string, boolean>
  confirmationGranted: boolean
}

interface SchedulerResult {
  ok: boolean
  status: 'ready' | 'awaiting_confirmation' | 'queued' | 'completed' | 'failed' | 'rejected'
  action: {
    type: string
    target: string
  }
  result?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}
```

## Non-Goals
The scheduler should not:
- hold rich conversation state
- invent missing context
- decide brand voice
- talk directly to the operator

It is an execution governor, not a personality layer.
