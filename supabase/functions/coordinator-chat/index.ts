import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

type ChatRole = 'user' | 'coordinator'

type ChatHistoryItem = {
  role: ChatRole
  content: string
}

type ConfirmationPayload = {
  title: string
  description: string
  action: string
}

type ChatResponse = {
  message: string
  suggestions: string[]
  confirmation?: ConfirmationPayload | null
  invoked_action?: {
    type: 'run_pipeline'
    pipeline: string
    status: 'queued' | 'running' | 'completed' | 'failed'
    run_id?: string | null
  } | null
}

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

const PIPELINE_TARGETS: Record<string, string> = {
  coordinator: 'coordinator',
  'pipeline-a-engagement': 'pipeline-a-engagement',
  'pipeline-b-weekly': 'pipeline-b-weekly',
  'pipeline-c-campaign': 'pipeline-c-campaign',
}

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

function inferPipelineTarget(text: string) {
  const normalized = text.toLowerCase()

  if (normalized.includes('engagement') || normalized.includes('pipeline a') || normalized.includes('pipeline-a')) {
    return {
      id: 'pipeline-a-engagement',
      title: 'Run Pipeline A - Engagement',
      description: 'This will process the latest engagement queue and flag escalations.',
    }
  }

  if (normalized.includes('weekly') || normalized.includes('pipeline b') || normalized.includes('pipeline-b') || normalized.includes('content pipeline')) {
    return {
      id: 'pipeline-b-weekly',
      title: 'Run Pipeline B - Weekly Content',
      description: 'This will draft the next content batch and queue approvals.',
    }
  }

  if (normalized.includes('campaign') || normalized.includes('pipeline c') || normalized.includes('pipeline-c')) {
    return {
      id: 'pipeline-c-campaign',
      title: 'Run Pipeline C - Campaign',
      description: 'This will generate the next campaign brief from the calendar trigger set.',
    }
  }

  if (normalized.includes('coordinator')) {
    return {
      id: 'coordinator',
      title: 'Run Coordinator',
      description: 'This will check due events and trigger any eligible downstream pipelines.',
    }
  }

  return null
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


const STALE_RUN_MINUTES = 10

function isStaleRunningRun(row: any) {
  if (row?.status !== 'running') return false

  const startedAt = row?.started_at ?? row?.created_at
  if (!startedAt) return false

  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  return Number.isFinite(elapsedMs) && elapsedMs > STALE_RUN_MINUTES * 60 * 1000
}

async function expireStaleRuns(supabase: any, rows: any[]) {
  const staleRunIds = (rows ?? [])
    .filter((row) => isStaleRunningRun(row))
    .map((row) => row.id)
    .filter(Boolean)

  if (staleRunIds.length === 0) {
    return rows ?? []
  }

  await supabase
    .from('pipeline_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      result: { error: 'Marked stale after exceeding runtime window' },
    })
    .in('id', staleRunIds)

  return (rows ?? []).map((row) =>
    staleRunIds.includes(row.id)
      ? {
          ...row,
          status: 'failed',
          finished_at: new Date().toISOString(),
          result: { error: 'Marked stale after exceeding runtime window' },
        }
      : row
  )
}

async function invokePipeline(supabase: any, pipelineId: string, orgId: string) {
  const functionName = PIPELINE_TARGETS[pipelineId]
  if (!functionName) {
    throw new Error(`Unknown pipeline target: ${pipelineId}`)
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { org_id: orgId },
  })

  if (error) {
    throw new Error(`Failed to invoke ${pipelineId}: ${error.message}`)
  }

  return data
}

function getLatestPipelineRun(rows: any[], pipelineId: string) {
  return (rows ?? []).find((row) => row.pipeline === pipelineId) ?? null
}

function formatElapsed(startedAt?: string | null) {
  if (!startedAt) return 'unknown duration'

  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'unknown duration'

  const totalMinutes = Math.floor(elapsedMs / (1000 * 60))
  if (totalMinutes < 1) return 'less than a minute'
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`
}

async function fetchLatestPipelineRun(supabase: any, orgId: string, pipelineId: string) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('org_id', orgId)
    .eq('pipeline', pipelineId)
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to load ${pipelineId} status: ${error.message}`)
  }

  return data?.[0] ?? null
}

function formatPipelineStatusResponse(pipeline: ReturnType<typeof inferPipelineTarget>, run: any) {
  if (!run) {
    return {
      message: `${pipeline?.title ?? 'That pipeline'} has no recorded runs yet. I can start it when you're ready.`,
      suggestions: ['Run the engagement pipeline', 'What needs my approval?', 'Summarize this week'],
    }
  }

  const startedAt = run.started_at ?? run.created_at ?? null
  const startedLabel = startedAt
    ? new Date(startedAt).toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Johannesburg',
      })
    : 'unknown time'

  if (run.status === 'running') {
    return {
      message: `${pipeline?.title ?? 'That pipeline'} is currently running (started ${startedLabel}, ${formatElapsed(startedAt)} ago).`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
    }
  }

  if (run.status === 'failed') {
    const reason = run.result?.error ?? run.result_summary ?? 'No failure summary recorded.'
    return {
      message: `${pipeline?.title ?? 'That pipeline'} last failed at ${startedLabel}. ${reason}`,
      suggestions: ['Run the engagement pipeline', 'Check pipeline results', 'What needs my approval?'],
    }
  }

  const summary = run.result_summary ?? run.result?.error ?? 'No summary recorded yet.'
  return {
    message: `${pipeline?.title ?? 'That pipeline'} last completed successfully at ${startedLabel}. ${summary}`,
    suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
  }
}

async function schedulePipelineRun(supabase: any, pipeline: ReturnType<typeof inferPipelineTarget>, orgId: string, runs: any[]) {
  const latestRun = getLatestPipelineRun(runs, pipeline.id)

  if (latestRun?.status === 'running') {
    const startedAt = latestRun.started_at ?? latestRun.created_at ?? null
    return {
      message: `${pipeline.title} is already running (started ${formatElapsed(startedAt)} ago).`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
      invoked_action: {
        type: 'run_pipeline' as const,
        pipeline: pipeline.id,
        status: 'running' as const,
        run_id: latestRun.id ?? null,
      },
    }
  }

  await invokePipeline(supabase, pipeline.id, orgId)
  const refreshedRun = await fetchLatestPipelineRun(supabase, orgId, pipeline.id)

  if (refreshedRun?.status === 'failed') {
    return {
      message: `${pipeline.title} failed immediately. ${refreshedRun.result?.error ?? 'No failure summary recorded.'}`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
      invoked_action: {
        type: 'run_pipeline' as const,
        pipeline: pipeline.id,
        status: 'failed' as const,
        run_id: refreshedRun.id ?? null,
      },
    }
  }

  if (refreshedRun?.status === 'success') {
    return {
      message: `${pipeline.title} completed successfully. ${refreshedRun.result_summary ?? refreshedRun.result?.error ?? 'The latest run is now reflected in workspace state.'}`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
      invoked_action: {
        type: 'run_pipeline' as const,
        pipeline: pipeline.id,
        status: 'completed' as const,
        run_id: refreshedRun.id ?? null,
      },
    }
  }

  return {
    message: `${pipeline.title} has been started and is now running.`,
    suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
    invoked_action: {
      type: 'run_pipeline' as const,
      pipeline: pipeline.id,
      status: 'running' as const,
      run_id: refreshedRun?.id ?? null,
    },
  }
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

    const directPipeline = confirmationAction ? inferPipelineTarget(confirmationAction) : null
    const requestedPipeline = inferPipelineTarget(message)
    const isExplicitConfirm = /^confirm\b/i.test(message)
    const isExplicitCancel = /^cancel\b/i.test(message)
    const isRunRequest = Boolean(requestedPipeline) && /\b(run|start|trigger|launch|execute)\b/i.test(message)
    const isStatusRequest = Boolean(requestedPipeline) && /\b(status|results?|running|logs?)\b/i.test(message)

    if (isStatusRequest && requestedPipeline) {
      const latestRun = getLatestPipelineRun(activeRuns, requestedPipeline.id)
      return jsonResponse(formatPipelineStatusResponse(requestedPipeline, latestRun))
    }

    if (isRunRequest && requestedPipeline && !isExplicitConfirm) {
      const scheduled = await schedulePipelineRun(supabase, requestedPipeline, orgId, activeRuns)
      return jsonResponse(scheduled)
    }

    if (isExplicitCancel) {
      return jsonResponse({
        message: 'Understood. I have not triggered anything. If you want, I can still summarize the current state or prepare the next run for review.',
        suggestions: ['Summarize this week', 'What needs my approval?', 'What is next on the calendar?'],
      })
    }

    if (isExplicitConfirm && directPipeline) {
      const scheduled = await schedulePipelineRun(supabase, directPipeline, orgId, activeRuns)
      return jsonResponse(scheduled)
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

    if (action?.type === 'run_pipeline' && action.pipeline && action.needs_confirmation === false) {
      const scheduled = await schedulePipelineRun(supabase, {
        id: action.pipeline,
        title: action.title,
        description: action.description,
      }, orgId, activeRuns)
      return jsonResponse({
        message: parsed.message || scheduled.message,
        suggestions,
        invoked_action: scheduled.invoked_action,
      })
    }

    if (action?.type === 'run_pipeline' && action.pipeline) {
      return jsonResponse({
        message: parsed.message || `I can do that next.`,
        suggestions,
        confirmation: {
          title: action.title,
          description: action.description,
          action: action.pipeline,
        },
      })
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
