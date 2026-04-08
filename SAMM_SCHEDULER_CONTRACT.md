# SAMM Codebase Mapping

## Purpose
This document maps the target `samm` runtime loop onto the current repository so future agent work can proceed with low ambiguity.

## Current Runtime Entry Point
Current coordinator-chat entry point:
- [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Current frontend entry point:
- [chat page](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\pages\agent\chat.tsx)

Current frontend invoke path:
- [api hook](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\lib\api.ts)

## Current State By Layer

### Session Layer
Current status:
- minimal only
- frontend holds message history in component state
- recent history is sent to the function on each turn

Current file:
- [chat page](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\pages\agent\chat.tsx)

Gap:
- no summarization
- no persisted conversation store
- no runtime-side session manager

### Context Builder
Current status:
- implemented directly inside the edge function
- shared state is pulled from Supabase tables inline

Current file:
- [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Current sources:
- `org_config`
- `platform_metrics`
- `pipeline_runs`
- `academic_calendar`
- `human_inbox`

Gap:
- context shaping is ad hoc
- no dedicated selector utilities
- no capability-aware filtering yet

### Coordinator Model Layer
Current status:
- present
- implemented as a single Anthropic call inside `coordinator-chat`

Current file:
- [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Gap:
- prompt is still thin
- personality is light
- no multi-turn internal orchestration

### Scheduler Layer
Current status:
- partial only
- there is direct action inference and direct pipeline invocation
- there is not yet a first-class scheduler module

Current file:
- [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Current behavior:
- infer pipeline target from message or confirmation action
- optionally invoke pipeline directly

Gap:
- no normalized scheduler request/result layer
- no reusable hard-limit enforcement abstraction
- no capability gating

### Response Formatter
Current status:
- partially implemented
- backend returns message, suggestions, and optional confirmation
- frontend maps that into the current `samm` UI message components

Current files:
- [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)
- [chat page](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\pages\agent\chat.tsx)

Gap:
- no shared response schema package
- frontend error handling still collapses all non-2xx responses into generic failures

## Mapping The Target Loop

### Step 1. Receive operator input
Current location:
- [chat page](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\pages\agent\chat.tsx)

### Step 2. Append to session
Current location:
- frontend component state in [chat page](C:\Users\Lusa\tsh-marketing-system\M.A.S%20UI\src\pages\agent\chat.tsx)

Future improvement:
- move session handling into a shared runtime/session module

### Step 3. Build prompt from session + memory + tools
Current location:
- inline in [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Future improvement:
- extract a context builder
- add capability flags
- add long-session summarization

### Step 4. Call model
Current location:
- Anthropic call in [coordinator-chat index](C:\Users\Lusa\tsh-marketing-system\supabase\functions\coordinator-chat\index.ts)

Future improvement:
- wrap in a coordinator-model adapter
- centralize prompt contract and parsing

### Step 5. If no tool calls, finish turn
Current location:
- implicit in current JSON contract when `action` is null

Future improvement:
- make termination explicit in a runtime result object

### Step 6. If tool calls, hand to scheduler
Current location:
- not truly separated yet

Required future work:
- create scheduler module and route all mutations through it

### Step 7. Append tool results to session
Current location:
- not implemented as a true loop yet

Required future work:
- runtime loop that can re-enter the coordinator with scheduler results

### Step 8. Repeat until done or bounded
Current location:
- not implemented

Required future work:
- bounded turn loop with hard controls

## Immediate Refactor Sequence
The safest next architecture sequence is:

1. Extract scheduler logic from `coordinator-chat` into its own internal module.
2. Introduce normalized scheduler request/result shapes.
3. Add hard controls around pipeline invocations and turn count.
4. Improve backend error normalization so the frontend can show useful failures.
5. Add capability flags into context selection.
6. Only after that, consider richer runtime memory or more tools.

## What Not To Do Yet
Do not yet:
- redesign the `samm` workspace UI around this architecture
- add many new tools before the scheduler contract exists
- add external API actions before the internal execution layer is bounded
- overcomplicate memory before current turn orchestration is stable

## Current Best Mental Model
Right now the repo has:
- a deployed chat-enabled coordinator function
- a thin action inference layer
- a good enough frontend shell

It does not yet have:
- a full runtime loop
- a first-class scheduler
- bounded multi-step orchestration

That is the correct next frontier for `samm`.
