// supabase/functions/coordinator/index.ts
// ─────────────────────────────────────────────────────────────────────
// Coordinator — runs daily at 07:00
// 1. reads org_config for pipeline switches and run_day
// 2. reads academic_calendar for events due to trigger today
// 3. reads platform_metrics for the latest snapshot
// 4. decides which pipelines to fire
// 5. logs the run to pipeline_runs
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── types ─────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string
  event_type: string
  event_date: string
  event_end_date: string | null
  label: string
  universities: string[]
  lead_days: number
  pipeline_trigger: 'pipeline_b' | 'pipeline_c'
}

interface PipelineContext {
  orgId: string
  today: string
  calendarEvents: CalendarEvent[]
  latestMetrics: Record<string, unknown>[]
  calendarEvent?: CalendarEvent
}

// ── org config helper ─────────────────────────────────────────────────
async function getOrgConfig(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('org_config')
    .select('*')
    .eq('org_id', orgId)
    .single()
  if (error) throw new Error(`Failed to load org config: ${error.message}`)
  return data
}

// ── main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // read ORG_ID from request body, falling back to env var
  const body = await req.json().catch(() => ({}))
  const ORG_ID: string = body.orgId ?? body.org_id ?? Deno.env.get('SUPABASE_ORG_ID') ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  const config = await getOrgConfig(supabase, ORG_ID)

  const today = new Date().toISOString().split('T')[0]
  const runId = await startRun(supabase, ORG_ID, 'coordinator')

  try {

    // ── 1. read calendar: events whose trigger window opens today ─────
    const { data: calendarEvents, error: calErr } = await supabase
      .from('academic_calendar')
      .select('*')
      .eq('org_id', ORG_ID)
      .eq('triggered', false)
      .lte('event_date', addDays(today, 21))
      .gte('event_date', today)

    if (calErr) throw calErr

    const dueToday = (calendarEvents ?? []).filter((e: CalendarEvent) => {
      const triggerOn = subtractDays(e.event_date, e.lead_days)
      return triggerOn <= today
    })

    // ── 2. read latest platform metrics ───────────────────────────────
    const { data: latestMetrics } = await supabase
      .from('platform_metrics')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('snapshot_date', { ascending: false })
      .limit(4)

    const context: PipelineContext = {
      orgId: ORG_ID,
      today,
      calendarEvents: dueToday,
      latestMetrics: latestMetrics ?? []
    }

    // ── 3. fire pipeline_a if enabled ─────────────────────────────────
    if (config.pipeline_config.pipeline_a.enabled) {
      await invokePipeline(supabase, 'pipeline-a-engagement', context)
    }

    // ── 4. fire pipeline_b on the configured run_day ──────────────────
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const pipelineBRunDay = (config.pipeline_config.pipeline_b.run_day ?? 'monday').toLowerCase()
    if (config.pipeline_config.pipeline_b.enabled && todayName === pipelineBRunDay) {
      await invokePipeline(supabase, 'pipeline-b-weekly', context)
    }

    // ── 5. fire pipeline_c for any calendar events due today ──────────
    if (config.pipeline_config.pipeline_c.enabled) {
      for (const event of dueToday) {
        if (event.pipeline_trigger === 'pipeline_c') {
          await invokePipeline(supabase, 'pipeline-c-campaign', {
            ...context,
            calendarEvent: event
          })
        }
        await supabase
          .from('academic_calendar')
          .update({
            triggered: true,
            triggered_at: new Date().toISOString()
          })
          .eq('id', event.id)
      }
    }

    const pipelinesBRunning = [
      config.pipeline_config.pipeline_a.enabled ? 1 : 0,
      (config.pipeline_config.pipeline_b.enabled && todayName === pipelineBRunDay) ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    await finishRun(supabase, runId, 'success', {
      pipelines_fired: dueToday.length + pipelinesBRunning,
      calendar_events_triggered: dueToday.length,
      events: dueToday.map((e: CalendarEvent) => e.label)
    })

    return new Response(
      JSON.stringify({
        ok: true,
        today,
        pipeline_b_day: pipelineBRunDay,
        today_is_run_day: todayName === pipelineBRunDay,
        calendar_events_triggered: dueToday.length,
        events: dueToday.map((e: CalendarEvent) => e.label)
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    await finishRun(supabase, runId, 'failed', { error: err.message })
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── helpers ───────────────────────────────────────────────────────────

async function invokePipeline(
  supabase: any,
  fnName: string,
  context: unknown
) {
  const { error } = await supabase.functions.invoke(fnName, { body: context })
  if (error) {
    console.error(`Failed to invoke ${fnName}:`, error.message)
    // don't throw — one pipeline failing shouldn't stop the others
  }
}

async function startRun(
  supabase: any,
  orgId: string,
  pipeline: string
): Promise<string> {
  const { data } = await supabase
    .from('pipeline_runs')
    .insert({ org_id: orgId, pipeline, status: 'running' })
    .select('id')
    .single()
  return data?.id
}

async function finishRun(
  supabase: any,
  runId: string,
  status: string,
  result: unknown
) {
  await supabase
    .from('pipeline_runs')
    .update({
      status,
      result,
      finished_at: new Date().toISOString()
    })
    .eq('id', runId)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days)
}
