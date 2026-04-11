# Pipeline C — Campaign Engine Design Spec

**Last updated:** 2026-04-11  
**Status:** Design locked. Implementation pending (starts with Milestone 11A — Event Context Pass-Through).

---

## Purpose

Pipeline C is the campaign production engine. It exists for coordinated, multi-platform content pushes tied to a specific academic calendar event. It is the right pipeline when the work requires a brief, research input, CEO sign-off, multi-platform copy, a design asset, and post-campaign monitoring.

It is not the right tool for one-off posts or quick content (see: One-Off Post Gap below).

---

## Current Agent Inventory

| Agent | Registry Key | Model | Runs | Role |
|---|---|---|---|---|
| Performance Analyser | `performance_analyser` | Sonnet 4.5 | Stage 1, parallel | Reads platform_metrics + content_registry, summarises perf context |
| Competitor Researcher | `competitor_researcher` | Sonnet 4.5 | Stage 1, parallel | Produces positioning insights for the event (**currently mocked**) |
| Ambassador Reporter | `ambassador_reporter` | None (DB read) | Stage 1, parallel | Reads ambassador_registry, returns coverage summary |
| Campaign Planner | `campaign_planner` | Sonnet 4.5 | Stage 1, sequential | Synthesises research + event into a CampaignBrief → CEO gate |
| Canonical Copy Writer | *(not yet registered)* | Sonnet 4.5 | Stage 2, sequential | Locks verbatim headline/CTA/key_fact for all platform adapters |
| Copy Writer × 6 | `copy_writer` | Sonnet 4.5 | Stage 2, parallel | Adapts canonical copy for 6 platform targets |
| Design Brief Agent | `design_brief_agent` | Sonnet 4.5 | Stage 2, parallel | Produces plain-text design brief for graphic designer |
| Monitor | `monitor` | Sonnet 4.5 | Stage 3, sequential | Checks campaign performance vs KPI targets, escalates if needed |
| Post-Campaign Reporter | `post_campaign_reporter` | Sonnet 4.5 | Stage 3, sequential | Compiles campaign report → CEO inbox (FYI) |

---

## Execution Stages

```
TRIGGER
  │
  ▼
[Stage 1 — Research + Brief]
  ├── parallel: performance_analyser
  ├── parallel: competitor_researcher
  ├── parallel: ambassador_reporter
  └── sequential: campaign_planner
        └── → human_inbox (campaign_brief, urgent)
              └── WAITING_HUMAN ◄─────────────────────── CEO approval gate
                                                          (3-day expiry)
  ▼ (resume after CEO approves)

[Stage 2 — Copy Production]
  ├── sequential: canonical_copy_writer (phase 1)
  └── parallel: copy_writer × 6 + design_brief_agent (phase 2)
        └── → content_registry (6 copy drafts + 1 design_brief, status: draft)
              └── WAITING_HUMAN ◄─────────────────────── Marketer approval gate
                                                          (all copy must be approved)
  ▼ (resume after all copy approved)

[Stage 3 — Monitor + Report]
  ├── sequential: monitor (checks vs KPI targets)
  └── sequential: post_campaign_reporter
        └── → human_inbox (campaign_report, fyi)
              └── SUCCESS
```

**Resume logic:**
- `pipeline_runs.result` (JSON) carries full `CampaignBrief` + `CalendarEvent` + intermediate counters across gate pauses
- Resume uses `resume_run_id` in the request payload
- If `copy_assets_created > 0` → Stage 3 path. Otherwise → Stage 2 path.
- Rejected copy → revision request in Inbox → run stays `waiting_human`

---

## Shared State Map

| Store | Written by | Read by | Purpose |
|---|---|---|---|
| `pipeline_runs.result` | pipeline-c at each stage | pipeline-c on resume | Carries CampaignBrief + CalendarEvent + counters across WAITING_HUMAN gaps |
| `human_inbox` | campaign_planner (brief), monitor (escalation), post_campaign_reporter (report) | CEO (brief), coordinator (report/escalation) | Workflow gates and FYI deliverables |
| `content_registry` | copy_writer (drafts), design_brief_agent (brief) | Marketer (approval), monitor (performance check) | All reviewable content outputs |
| `org_config.brand_voice` | Settings UI | canonical_copy_writer, copy_writer, design_brief_agent | Brand voice constraints for all LLM copy calls |
| `org_config.kpi_targets` | Settings UI | monitor | KPI benchmark for performance evaluation |
| `academic_calendar` | Calendar UI / samm NL commands | pipeline-c at trigger (event selection) | Source of the event being campaigned for |

---

## Known Design Problems (all 7)

### Problem 1 — Pipeline C ignores the triggering event ★ (fix first)

**What happens:** When `coordinator-chat` triggers Pipeline C via `schedulePipelineRun`, no event context is passed. Pipeline C falls through to a hardcoded demo event:
```typescript
calendarEvent: payload?.calendarEvent ?? {
  id: 'demo-event',
  event_type: 'exam_window',
  event_date: '2026-05-11',
  label: 'UNZA semester 1 exams 2026',
  ...
}
```
The demo event is always used when triggered from samm chat, regardless of what event the user named.

**Root cause:** `schedulePipelineRun` in `scheduler.ts` calls the edge function with only `{ orgId }`. It has no mechanism for passing additional context. `coordinator-chat` has the event in `action.label`/`action.event_date` after a `create_calendar_event` action, but this is never forwarded.

**Fix design — Event Context Pass-Through (see full design below):**
Two paths need to be handled:
1. **Calendar-triggered run** ("schedule a campaign for X on [date] and run the pipeline"): `coordinator-chat` already has the event label and date in `action`. Pass it as `calendarEvent` in the invoke payload.
2. **Standalone run** ("run the campaign pipeline"): no specific event named. Pipeline C should query `academic_calendar` for the next upcoming event at runtime, rather than using a hardcoded demo.

---

### Problem 2 — Campaign duration is unconstrained (model hallucinates 30+ days)

**What happens:** `campaign_planner` receives `days_until_event` as context but has no constraint on `duration_days`. The model defaults to 30-31 days — treating the campaign like an evergreen effort rather than a targeted pre-event push.

**Why it's wrong:** A campaign tied to an event happening in 3 weeks should run for at most 7-14 days. Running for 30 days means posts are being "scheduled" for dates after the event has already passed.

**Fix design:**
- Compute `max_duration = Math.min(days_until_event, 14)` in `runCampaignPlanner` before the LLM call
- Pass `max_duration_days` explicitly in the prompt: `"Duration must not exceed ${max_duration} days. Recommended: 7-${max_duration} days for a pre-event push."`
- Do not let the model freely choose any value

---

### Problem 3 — Post scheduling offsets from today, not campaign start

**What happens:** `getScheduledTime(dayOffset, today)` uses the index position (0-5) as `dayOffset`, counting forward from today. If the event is 3 weeks away, all 6 posts are scheduled in the first 6 days from now — a burst right after pipeline runs, not spread across the campaign window.

**Fix design:**
- Compute `campaignStartDate` = today (first post goes out now or tomorrow)
- Compute `campaignEndDate` = `event_date - N days` (last post before event day; N = 1 or 2)
- Spread posts evenly across `campaignStartDate → campaignEndDate` window
- Formula: `dayOffset = Math.floor(i * (windowDays / (platforms.length - 1)))`
- Pass `event_date` and `window_days` into `getScheduledTime` instead of raw index

---

### Problem 4 — Monitor runs before publishing, not after

**What happens:** Stage 3 fires `runMonitor` immediately after copy approval. At this point, content_registry rows are `scheduled` (not `published`). No posts have gone live on any platform. `platform_metrics` reflects the pre-campaign baseline. The monitor is checking nothing real.

**Why it's wrong:** Monitor output (`on_track | underperforming`) is meaningless without post-campaign data. The current report is a structural placeholder that always says "on track" because there's nothing to be off track from.

**Fix design (two options):**
- **Option A (deferred):** Remove monitor from Stage 3 entirely. Run it as a scheduled check 3-5 days after campaign posts are published (requires scheduled triggers, M11+ territory).
- **Option B (immediate):** Keep monitor in Stage 3 but reframe it as a "campaign readiness check" — it checks whether the calendar event, brand voice, and KPI targets are coherent, not whether posts performed. Update the system prompt to reflect this.
- **Recommended now:** Option B. Reframe the prompt. Honest about what's being checked. Reserve the real performance monitor for M11 when actual metrics from live platforms are available.

---

### Problem 5 — Competitor researcher is permanently mocked

**What happens:** `runCompetitorResearcher` system prompt says: "Provide mock competitor insights for campaign planning." It hallucinates plausible-sounding EdTech Zambia competitor data every time.

**Why it matters:** The `campaign_planner` receives this as real data and builds positioning strategy around it. The brief looks research-backed but is not.

**Fix design:**
- Short term: keep the mock but label it explicitly in the brief payload as `competitor_insights_source: 'simulated'`
- Medium term (M11+): replace with web scraping or a structured competitor knowledge base that is manually maintained and read at pipeline start
- Do not remove the agent slot — it is architecturally correct. Change the data source, not the structure.

---

### Problem 6 — Canonical Copy Writer is not in the agent registry

**What happens:** `runCanonicalCopyWriter` is a named function but has no entry in `AGENT_REGISTRY`. Every other agent in Pipeline C is registered. This one is invisible to any tooling, capability gating, or audit trail that reads the registry.

**Fix design:**
- Add `canonical_copy_writer` to `AGENT_REGISTRY` with:
  - `required_inputs: ['campaign_brief', 'brand_voice', 'calendar_event']`
  - `produced_outputs: ['canonical_copy']` (headline, core_body, exact_cta, key_fact)
  - `supports_human_gate_handoff: false`
  - `enabled_by_capability: 'campaigns_enabled'`

---

### Problem 7 — `event_end_date` is declared but not in the DB

**What happens:** `CalendarEvent` interface declares `event_end_date: string | null`. No migration adds this column to `academic_calendar`. The hardcoded demo event supplies it; real calendar events don't. This silently returns `null` for every real event.

**Fix design:**
- Add `event_end_date date` column via migration (nullable)
- Add `event_end_date` field to the Calendar UI form (optional date picker, labelled "End date (optional)")
- The campaign planner can then use the event window for duration calculation instead of guessing

---

## Event Context Pass-Through — Full Design

This is the most impactful fix and the one that must be locked before any code is written.

### The problem, precisely

There are two trigger paths for Pipeline C:

```
Path A: samm chat → "schedule a campaign for X on [date] and run the pipeline"
  coordinator-chat receives action.type = 'create_calendar_event' with run_pipeline_c: true
  coordinator-chat calls resolveModelPipelineAction({ action: { pipeline: 'pipeline-c-campaign', ... } })
  resolveModelPipelineAction calls schedulePipelineRun(supabase, pipeline, orgId, runs)
  schedulePipelineRun invokes pipeline-c with { orgId } only
  Pipeline C: payload.calendarEvent is undefined → uses hardcoded demo event ✗

Path B: samm chat → "run the campaign pipeline"
  coordinator-chat calls resolveExplicitSchedulerRequest
  schedulePipelineRun invoked with { orgId } only
  Pipeline C: payload.calendarEvent is undefined → uses hardcoded demo event ✗
```

### Fix for Path A — pass event from coordinator-chat

In `coordinator-chat/index.ts`, the `create_calendar_event` handler already has `action.label`, `action.event_date`, `action.event_type`, `action.universities`. It needs to pass these to the pipeline trigger.

**Change to `resolveModelPipelineAction` signature:**
```typescript
// Before
export async function resolveModelPipelineAction(params: {
  supabase, orgId, runs, action, fallbackMessage, suggestions
})

// After
export async function resolveModelPipelineAction(params: {
  supabase, orgId, runs, action, fallbackMessage, suggestions,
  eventContext?: CalendarEventContext  // optional
})
```

**New type in scheduler.ts:**
```typescript
export interface CalendarEventContext {
  label: string
  event_date: string
  event_type: string
  universities: string[]
}
```

**In `schedulePipelineRun`, add eventContext to payload:**
```typescript
async function schedulePipelineRun(supabase, pipeline, orgId, runs, eventContext?) {
  const invokePayload: Record<string, unknown> = { orgId }
  if (eventContext) {
    invokePayload.calendarEvent = {
      id: 'from-nl-trigger',
      label: eventContext.label,
      event_date: eventContext.event_date,
      event_type: eventContext.event_type,
      event_end_date: null,
      universities: eventContext.universities,
      lead_days: 21
    }
  }
  // invoke with invokePayload
}
```

**In coordinator-chat/index.ts, pass event when triggering from calendar creation:**
```typescript
if (action.run_pipeline_c) {
  const pipelineResult = await resolveModelPipelineAction({
    supabase, orgId, runs: activeRuns,
    action: { type: 'run_pipeline', pipeline: 'pipeline-c-campaign', ... },
    fallbackMessage: ...,
    suggestions,
    eventContext: {               // ← pass event from the action
      label: action.label,
      event_date: action.event_date,
      event_type: action.event_type ?? 'other',
      universities: action.universities ?? [],
    }
  })
}
```

### Fix for Path B — query next upcoming event at pipeline start

When `payload.calendarEvent` is absent (standalone run, no NL event context), Pipeline C should query `academic_calendar` for the next upcoming event at runtime instead of using the hardcoded demo.

**In pipeline-c/index.ts, replace the hardcoded fallback:**
```typescript
// Before
calendarEvent: payload?.calendarEvent ?? { id: 'demo-event', ... hardcoded ... }

// After
calendarEvent: payload?.calendarEvent ?? await getNextCalendarEvent(supabase, orgId, today)
```

**New helper:**
```typescript
async function getNextCalendarEvent(supabase, orgId, today) {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('id, event_type, event_date, event_end_date, label, universities, lead_days')
    .eq('org_id', orgId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) throw new Error('No upcoming calendar event found. Add an event to the Academic Calendar before running a campaign.')
  return data
}
```

This surfaces a clear, actionable error if there is no upcoming event — much better than silently running for a demo event that doesn't exist.

### The fallback hierarchy

```
Pipeline C calendarEvent source, in order:
1. payload.calendarEvent (passed from coordinator-chat when triggered from NL calendar create)
2. DB query: next upcoming event in academic_calendar (for standalone "run the campaign pipeline")
3. ERROR — no upcoming event, surface to user via pipeline failure + inbox item
```

The hardcoded demo event is removed entirely.

---

## One-Off Post Gap — Architecture Decision

### What it is
"Write a quick post about X" — a single piece of content, not tied to a full campaign workflow. No brief, no research, no CEO gate, no design asset. Just copy → review → publish.

### Why Pipeline C is wrong for this
Pipeline C always produces: brief (CEO gate) → 6 platform assets → design brief (marketer gate) → monitor → report. That is 9 LLM calls, 2 human gates, and ~60 seconds minimum. A one-off post needs 1 LLM call, 1 human gate, and < 5 seconds.

### Why Pipeline B is wrong for this
Pipeline B is a weekly batch generator. It is scheduled, not event-triggered. It produces a set of posts for the week based on the content plan. It has no mechanism for "write a post about this specific topic now."

### The gap
No pipeline handles: "Write a post about [topic/event] for [platform]" as an ad-hoc, low-friction request.

### Future design (not scoped yet — defer to post-M11)
A lightweight content request pipeline ("Pipeline D" or "Pipeline C Lite") that:
- Accepts a topic, platform list, and optional event reference from samm chat
- Skips brief, research, and monitor phases
- Runs canonical_copy_writer + copy_writer for the requested platforms only
- Sends 1-3 drafts to Content Registry for marketer review
- No CEO gate (not a campaign-level decision)
- Completes in < 10 seconds

**samm routing rule (to implement when Pipeline D exists):**
- "Run a campaign for X" → Pipeline C
- "Write a post about X" / "Draft a post for [platform]" → Pipeline D
- "Run the engagement pipeline" → Pipeline A
- "Run the weekly pipeline" → Pipeline B

**Until Pipeline D exists:** samm should respond to one-off post requests with: "I can draft a full campaign for that event, or you can write a post directly in the Content Registry. A quick one-off post pipeline is on the roadmap."

---

## Implementation Order (all 7 fixes)

| # | Fix | Milestone label | Dependency |
|---|---|---|---|
| 1 | Event context pass-through (Path A + B) | M11A | None — fix first |
| 2 | Campaign duration constraint | M11B | M11A (needs real event context to compute days_until_event) |
| 3 | Post scheduling spread across campaign window | M11B | M11A |
| 4 | Monitor reframe (readiness check, not perf check) | M11C | None |
| 5 | Label competitor researcher as simulated | M11C | None |
| 6 | Register canonical_copy_writer in agent registry | M11C | None |
| 7 | event_end_date migration + Calendar UI field | M11D | None |

M11A and M11B ship together as the core event-context slice. M11C is a polish pass on honesty/accuracy. M11D is a data model extension.

**Do not start M11A implementation until this doc is committed and the design is reviewed.**

---

## What Does Not Change

- The CEO brief gate (Stage 1 → WAITING_HUMAN) — remains
- The marketer copy gate (Stage 2 → WAITING_HUMAN) — remains
- The canonical copy writer → 6 parallel adapters structure — remains
- The design brief → Content Registry flow — remains
- The revision request → rejection loop — remains
- The campaign_name + pipeline_run_id tagging on content_registry rows — remains
- The `pipeline_runs.result` as shared state carrier — remains
- The fire-and-forget resume via EdgeRuntime.waitUntil — remains
