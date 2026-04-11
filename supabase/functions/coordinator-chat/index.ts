import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import {
  expireStaleRuns,
  resolveExplicitSchedulerRequest,
  resolveModelPipelineAction,
  type ChatHistoryItem,
  type ChatResponse,
} from './scheduler.ts'

type ChatRole = 'user' | 'coordinator'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const DEFAULT_SUGGESTIONS = [
  'Summarize this week',
  'What needs my approval?',
  'What is next on the calendar?',
  'Run the engagement pipeline',
]

function jsonResponse(body: ChatResponse | { error: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function extractJSON(text: string, fallback = '{}') {
  try {
    const firstBrace = text.indexOf('{')
    const firstBracket = text.indexOf('[')
    const lastBrace = text.lastIndexOf('}')
    const lastBracket = text.lastIndexOf(']')

    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1) && lastBracket !== -1) {
      return text.slice(firstBracket, lastBracket + 1)
    }

    if (firstBrace !== -1 && lastBrace !== -1) {
      return text.slice(firstBrace, lastBrace + 1)
    }
  } catch (_error) {
    // Fall through to fallback below.
  }

  return fallback
}

function summarizeRuns(rows: any[]) {
  return rows.map((row) => ({
    pipeline: row.pipeline,
    status: row.status,
    started_at: row.started_at ?? row.created_at,
    summary: row.result_summary ?? row.error_message ?? row.result?.error ?? '-',
  }))
}

function summarizeMetrics(rows: any[]) {
  return rows.slice(0, 6).map((row) => ({
    platform: row.platform,
    snapshot_date: row.snapshot_date,
    followers: row.followers ?? 0,
    reach: row.post_reach ?? row.reach ?? 0,
    engagement: row.engagement_rate ?? row.engagement ?? 0,
    signups: row.signups ?? 0,
  }))
}

function summarizeEvents(rows: any[]) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    event_type: row.event_type,
    event_date: row.event_date,
    universities: row.universities ?? [],
    lead_days: row.lead_days ?? null,
    pipeline_trigger: row.pipeline_trigger ?? null,
  }))
}

function summarizeInbox(rows: any[]) {
  return rows.map((row) => ({
    title: row.payload?.title ?? row.item_type,
    item_type: row.item_type,
    priority: row.priority,
    created_at: row.created_at,
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service credentials in function environment')
    }

    if (!anthropicApiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY in function environment')
    }

    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '')

    if (!accessToken) {
      return jsonResponse({ error: 'Missing bearer token' }, 401)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      return jsonResponse({ error: userError?.message ?? 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const message = String(body?.message ?? '').trim()
    const history = Array.isArray(body?.history) ? (body.history as ChatHistoryItem[]) : []
    const confirmationAction = body?.confirmationAction ? String(body.confirmationAction) : null
    const orgId = user.app_metadata?.org_id ?? body?.orgId ?? DEFAULT_ORG_ID

    if (!message) {
      return jsonResponse({ error: 'Message is required' }, 400)
    }

    const today = new Date().toISOString().slice(0, 10)

    const [orgConfigResult, metricsResult, runsResult, eventsResult, inboxCountResult, inboxResult] = await Promise.all([
      supabase.from('org_config').select('*').eq('org_id', orgId).single(),
      supabase.from('platform_metrics').select('*').eq('org_id', orgId).order('snapshot_date', { ascending: false }).limit(8),
      supabase.from('pipeline_runs').select('*').eq('org_id', orgId).order('started_at', { ascending: false }).limit(8),
      supabase.from('academic_calendar').select('*').eq('org_id', orgId).gte('event_date', today).order('event_date', { ascending: true }).limit(5),
      supabase.from('human_inbox').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending'),
      supabase.from('human_inbox').select('*').eq('org_id', orgId).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    ])

    if (orgConfigResult.error) throw new Error(`Failed to load org config: ${orgConfigResult.error.message}`)
    if (metricsResult.error) throw new Error(`Failed to load metrics: ${metricsResult.error.message}`)
    if (runsResult.error) throw new Error(`Failed to load pipeline runs: ${runsResult.error.message}`)
    if (eventsResult.error) throw new Error(`Failed to load calendar events: ${eventsResult.error.message}`)
    if (inboxCountResult.error) throw new Error(`Failed to load inbox summary: ${inboxCountResult.error.message}`)
    if (inboxResult.error) throw new Error(`Failed to load inbox items: ${inboxResult.error.message}`)

    const activeRuns = await expireStaleRuns(supabase, runsResult.data ?? [])

    const orgConfig = orgConfigResult.data
    const metrics = summarizeMetrics(metricsResult.data ?? [])
    const recentRuns = summarizeRuns(activeRuns)
    const upcomingEvents = summarizeEvents(eventsResult.data ?? [])
    const pendingInbox = summarizeInbox(inboxResult.data ?? [])
    const pendingCount = inboxCountResult.count ?? 0

    const explicitSchedulerResult = await resolveExplicitSchedulerRequest({
      supabase,
      orgId,
      message,
      confirmationAction,
      runs: activeRuns,
    })

    if (explicitSchedulerResult) {
      return jsonResponse(explicitSchedulerResult)
    }

    const prompt = {
      workspace: {
        org_name: orgConfig?.org_name ?? 'this workspace',
        full_name: orgConfig?.full_name ?? '',
        timezone: orgConfig?.timezone ?? '',
        pending_inbox_count: pendingCount,
        pending_inbox: pendingInbox,
        recent_runs: recentRuns,
        upcoming_events: upcomingEvents,
        latest_metrics: metrics,
      },
      conversation: [...history.slice(-8), { role: 'user', content: message }],
      instruction: `You are samm, the coordinating intelligence for this workspace. Decide whether to answer directly or prepare an action. Return JSON only with this shape:
{"message": string, "suggestions": string[], "action": null | ActionObject}

ActionObject is one of:
- {"type":"run_pipeline","pipeline":"pipeline-a-engagement"|"pipeline-b-weekly"|"pipeline-c-campaign"|"coordinator","needs_confirmation": boolean, "title": string, "description": string}
- {"type":"create_calendar_event","label": string, "event_date": "YYYY-MM-DD", "event_type": "exam"|"registration"|"holiday"|"orientation"|"graduation"|"other", "universities": string[], "run_pipeline_c": boolean, "needs_confirmation": boolean, "title": string, "description": string}
- {"type":"edit_calendar_event","event_id": string, "label"?: string, "event_date"?: string, "event_type"?: string, "needs_confirmation": boolean, "title": string, "description": string}
- {"type":"delete_calendar_event","event_id": string, "label": string, "needs_confirmation": boolean, "title": string, "description": string}

Rules:
- Only propose run_pipeline when the user is clearly asking to run or trigger work with no event creation involved.
- Use create_calendar_event when the user asks to schedule, add, or create a calendar event.
  - Infer the date from the user message (e.g. "next Friday" relative to today ${today}).
  - If the user says "schedule a campaign for [event] on [date] and run the pipeline" — use create_calendar_event with run_pipeline_c: true. Do NOT use run_pipeline for this; the event must be created first.
  - Set run_pipeline_c to true only if the user also asks to draft, create, or run a campaign for that event.
  - universities defaults to ["UNZA","CBU","MU","ZCAS","DMI"] if none are specified.
- Use edit_calendar_event when the user asks to update, change, rename, or reschedule an existing event. Match the event by label or date from the upcoming_events list and use its id. Always set needs_confirmation: false for edits — they are reversible.
- Use delete_calendar_event when the user asks to remove or delete an existing event. Match from upcoming_events and use its id. Always set needs_confirmation: true for deletes — they are permanent.
- For status questions, summaries, metrics, approvals, and calendar reads, answer directly.
- Keep suggestions short and actionable.`
    }

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: 'You are samm. Be concise, operational, and clear. Return JSON only.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify(prompt),
        },
      ],
    })

    const rawText = completion.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n')

    const parsed = JSON.parse(extractJSON(rawText, '{"message":"I reviewed the workspace state.","suggestions":[]}'))

    const suggestions = Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
      ? parsed.suggestions.slice(0, 4)
      : DEFAULT_SUGGESTIONS

    const action = parsed.action && typeof parsed.action === 'object' ? parsed.action : null

    if (action?.type === 'create_calendar_event') {
      if (action.needs_confirmation && !confirmationAction) {
        return jsonResponse({
          message: parsed.message || action.description || `Create "${action.label}" on ${action.event_date}?`,
          suggestions,
          action,
        })
      }

      if (confirmationAction === 'cancel') {
        return jsonResponse({ message: 'Cancelled.', suggestions })
      }

      const calendarPayload = {
        org_id: orgId,
        label: action.label,
        event_date: action.event_date,
        event_type: action.event_type ?? 'other',
        universities: action.universities ?? [],
        triggered: false,
        lead_days: 21,
        pipeline_trigger: 'pipeline_c',
      }

      const { error: calInsertError } = await supabase
        .from('academic_calendar')
        .insert(calendarPayload)

      if (calInsertError) {
        return jsonResponse({ error: `Failed to create calendar event: ${calInsertError.message}` }, 500)
      }

      if (action.run_pipeline_c) {
        const pipelineAction = {
          type: 'run_pipeline',
          pipeline: 'pipeline-c-campaign',
          needs_confirmation: false,
          title: `Campaign for ${action.label}`,
          description: `Triggered by calendar event creation.`,
        }
        const pipelineResult = await resolveModelPipelineAction({
          supabase,
          orgId,
          runs: activeRuns,
          action: pipelineAction,
          fallbackMessage: `Added "${action.label}" to the calendar and queued a campaign run.`,
          suggestions,
        })
        if (pipelineResult) return jsonResponse(pipelineResult)
      }

      return jsonResponse({
        message: `Added "${action.label}" on ${action.event_date} to the calendar.`,
        suggestions,
      })
    }

    if (action?.type === 'edit_calendar_event') {
      if (!action.event_id) {
        return jsonResponse({ message: "I couldn't identify which event to edit. Please specify the event name and date.", suggestions })
      }

      if (action.needs_confirmation && !confirmationAction) {
        return jsonResponse({ message: parsed.message || action.description || `Update "${action.label}"?`, suggestions, action })
      }

      const patch: Record<string, unknown> = {}
      if (action.label) patch.label = action.label
      if (action.event_date) patch.event_date = action.event_date
      if (action.event_type) patch.event_type = action.event_type

      const { error: editError } = await supabase
        .from('academic_calendar')
        .update(patch)
        .eq('id', action.event_id)
        .eq('org_id', orgId)

      if (editError) {
        return jsonResponse({ error: `Failed to update calendar event: ${editError.message}` }, 500)
      }

      return jsonResponse({ message: parsed.message || `Updated the event.`, suggestions })
    }

    if (action?.type === 'delete_calendar_event') {
      if (!action.event_id) {
        return jsonResponse({ message: "I couldn't identify which event to delete. Please specify the event name and date.", suggestions })
      }

      if (action.needs_confirmation && !confirmationAction) {
        return jsonResponse({ message: parsed.message || `Delete "${action.label}"?`, suggestions, action })
      }

      if (confirmationAction === 'cancel') {
        return jsonResponse({ message: 'Cancelled. The event has not been deleted.', suggestions })
      }

      const { error: deleteError } = await supabase
        .from('academic_calendar')
        .delete()
        .eq('id', action.event_id)
        .eq('org_id', orgId)

      if (deleteError) {
        return jsonResponse({ error: `Failed to delete calendar event: ${deleteError.message}` }, 500)
      }

      return jsonResponse({ message: parsed.message || `Deleted "${action.label}" from the calendar.`, suggestions })
    }

    const modelSchedulerResult = await resolveModelPipelineAction({
      supabase,
      orgId,
      runs: activeRuns,
      action,
      fallbackMessage: parsed.message || '',
      suggestions,
    })

    if (modelSchedulerResult) {
      return jsonResponse(modelSchedulerResult)
    }

    return jsonResponse({
      message: parsed.message || 'I reviewed the latest workspace state and prepared the next steps.',
      suggestions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
