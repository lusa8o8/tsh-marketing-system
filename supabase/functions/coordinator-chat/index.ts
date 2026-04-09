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
      instruction: `You are samm, the coordinating intelligence for this workspace. Decide whether to answer directly or prepare a pipeline action. Return JSON only with this shape: {"message": string, "suggestions": string[], "action": null | {"type":"run_pipeline","pipeline":"pipeline-a-engagement"|"pipeline-b-weekly"|"pipeline-c-campaign"|"coordinator","needs_confirmation": boolean, "title": string, "description": string}}. Only propose pipeline actions when the user is clearly asking to run or trigger work. For status questions, summaries, metrics, approvals, and calendar questions, answer directly. Keep suggestions short and actionable.`
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
