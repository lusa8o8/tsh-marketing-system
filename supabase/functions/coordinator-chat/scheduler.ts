import {
  PIPELINE_RUN_STATUS,
  isPipelineRunBlocking,
  isPipelineRunExecuting,
} from '../_shared/pipeline-run-status.ts'

// EdgeRuntime is a Supabase Edge Runtime global — not in standard Deno types.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

const PIPELINE_TARGETS: Record<string, string> = {
  coordinator: 'coordinator',
  'pipeline-a-engagement': 'pipeline-a-engagement',
  'pipeline-b-weekly': 'pipeline-b-weekly',
  'pipeline-c-campaign': 'pipeline-c-campaign',
}

const STALE_RUN_MINUTES = 10

type ChatRole = 'user' | 'coordinator'

export type ChatHistoryItem = {
  role: ChatRole
  content: string
}

export type ConfirmationPayload = {
  title: string
  description: string
  action: string
}

export type ChatResponse = {
  message: string
  suggestions: string[]
  confirmation?: ConfirmationPayload | null
  invoked_action?: {
    type: 'run_pipeline'
    pipeline: string
    status: 'queued' | 'running' | 'waiting_human' | 'resumed' | 'completed' | 'failed' | 'cancelled'
    run_id?: string | null
  } | null
}

export type PipelineTarget = {
  id: string
  title: string
  description: string
}

type SchedulerAction = {
  type?: string
  pipeline?: string
  needs_confirmation?: boolean
  title?: string
  description?: string
} | null

type ExplicitSchedulerParams = {
  supabase: any
  orgId: string
  message: string
  confirmationAction?: string | null
  runs: any[]
}

type ModelSchedulerParams = {
  supabase: any
  orgId: string
  runs: any[]
  action: SchedulerAction
  fallbackMessage: string
  suggestions: string[]
}

export function inferPipelineTarget(text: string): PipelineTarget | null {
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

function isStaleRunningRun(row: any) {
  if (!isPipelineRunExecuting(row?.status)) return false

  const startedAt = row?.started_at ?? row?.created_at
  if (!startedAt) return false

  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  return Number.isFinite(elapsedMs) && elapsedMs > STALE_RUN_MINUTES * 60 * 1000
}

export async function expireStaleRuns(supabase: any, rows: any[]) {
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
      status: PIPELINE_RUN_STATUS.FAILED,
      finished_at: new Date().toISOString(),
      result: { error: 'Marked stale after exceeding runtime window' },
    })
    .in('id', staleRunIds)

  return (rows ?? []).map((row) =>
    staleRunIds.includes(row.id)
      ? {
          ...row,
          status: PIPELINE_RUN_STATUS.FAILED,
          finished_at: new Date().toISOString(),
          result: { error: 'Marked stale after exceeding runtime window' },
        }
      : row
  )
}

async function invokePipeline(supabase: any, pipelineId: string, orgId: string, body: Record<string, unknown> = {}) {
  const functionName = PIPELINE_TARGETS[pipelineId]
  if (!functionName) {
    throw new Error(`Unknown pipeline target: ${pipelineId}`)
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      org_id: orgId,
      ...body,
    },
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

function formatPipelineStatusResponse(pipeline: PipelineTarget, run: any): ChatResponse {
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

  if (run.status === PIPELINE_RUN_STATUS.WAITING_HUMAN) {
    return {
      message: `${pipeline?.title ?? 'That pipeline'} is waiting on human approval before it can continue.`,
      suggestions: ['What needs my approval?', 'Check pipeline results', 'Summarize this week'],
    }
  }

  if (run.status === PIPELINE_RUN_STATUS.RUNNING || run.status === PIPELINE_RUN_STATUS.RESUMED) {
    return {
      message: `${pipeline?.title ?? 'That pipeline'} is currently running (started ${startedLabel}, ${formatElapsed(startedAt)} ago).`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
    }
  }

  if (run.status === PIPELINE_RUN_STATUS.FAILED) {
    const reason = run.result?.error ?? run.result_summary ?? 'No failure summary recorded.'
    return {
      message: `${pipeline?.title ?? 'That pipeline'} last failed at ${startedLabel}. ${reason}`,
      suggestions: ['Run the engagement pipeline', 'Check pipeline results', 'What needs my approval?'],
    }
  }

  if (run.status === PIPELINE_RUN_STATUS.CANCELLED) {
    const reason = run.result?.error ?? run.result_summary ?? 'No cancellation summary recorded.'
    return {
      message: `${pipeline?.title ?? 'That pipeline'} was cancelled at ${startedLabel}. ${reason}`,
      suggestions: ['Run the engagement pipeline', 'Check pipeline results', 'What needs my approval?'],
    }
  }

  const summary = run.result_summary ?? run.result?.error ?? 'No summary recorded yet.'
  return {
    message: `${pipeline?.title ?? 'That pipeline'} last completed successfully at ${startedLabel}. ${summary}`,
    suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
  }
}

async function schedulePipelineRun(supabase: any, pipeline: PipelineTarget, orgId: string, runs: any[]): Promise<ChatResponse> {
  const latestRun = getLatestPipelineRun(runs, pipeline.id)

  if (isPipelineRunBlocking(latestRun?.status)) {
    const startedAt = latestRun.started_at ?? latestRun.created_at ?? null
    return {
      message: latestRun?.status === PIPELINE_RUN_STATUS.WAITING_HUMAN
        ? `${pipeline.title} is waiting on human approval before it can continue.`
        : `${pipeline.title} is already running (started ${formatElapsed(startedAt)} ago).`,
      suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
      invoked_action: {
        type: 'run_pipeline',
        pipeline: pipeline.id,
        status: latestRun?.status === PIPELINE_RUN_STATUS.WAITING_HUMAN
          ? PIPELINE_RUN_STATUS.WAITING_HUMAN
          : latestRun?.status === PIPELINE_RUN_STATUS.RESUMED
            ? PIPELINE_RUN_STATUS.RESUMED
            : PIPELINE_RUN_STATUS.RUNNING,
        run_id: latestRun.id ?? null,
      },
    }
  }

  // Fire the pipeline in the background so coordinator-chat returns immediately.
  // The toast on the frontend fires as soon as this response lands (<1s).
  // Pipeline status and run rows are visible in Operations once the run starts.
  const runTask = invokePipeline(supabase, pipeline.id, orgId)
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Background run of ${pipeline.id} failed: ${msg}`)
    })

  try {
    EdgeRuntime.waitUntil(runTask)
  } catch {
    // EdgeRuntime not available outside Supabase — promise still runs
  }

  return {
    message: `${pipeline.title} has been started. Check Operations for live status.`,
    suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
    invoked_action: {
      type: 'run_pipeline',
      pipeline: pipeline.id,
      status: PIPELINE_RUN_STATUS.RUNNING,
      run_id: null,
    },
  }
}

async function resumePipelineRun(supabase: any, pipeline: PipelineTarget, orgId: string, runs: any[]): Promise<ChatResponse> {
  // Query directly for the most recent waiting_human run for this pipeline.
  // Do not rely on the pre-loaded runs snapshot: it is limited to 8 rows across all
  // pipelines and may not contain this pipeline's waiting run, or may contain a more
  // recent run in a different terminal state, causing the resume to silently no-op.
  const { data: waitingRows } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('org_id', orgId)
    .eq('pipeline', pipeline.id)
    .eq('status', PIPELINE_RUN_STATUS.WAITING_HUMAN)
    .order('started_at', { ascending: false })
    .limit(1)

  const waitingRun = waitingRows?.[0] ?? null

  if (!waitingRun) {
    const latestRun = getLatestPipelineRun(runs, pipeline.id)
    return formatPipelineStatusResponse(pipeline, latestRun)
  }

  // Fire the pipeline resume in the background. The resume does significant work
  // (multiple LLM calls) that would block coordinator-chat from responding to the
  // browser. Return immediately after scheduling so the approval mutation completes
  // cleanly. EdgeRuntime.waitUntil keeps the edge function alive until the resume
  // finishes, even after the HTTP response is sent.
  const resumeTask = invokePipeline(supabase, pipeline.id, orgId, { resume_run_id: waitingRun.id })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Background resume of ${pipeline.id} run ${waitingRun.id} failed: ${msg}`)
    })

  try {
    EdgeRuntime.waitUntil(resumeTask)
  } catch {
    // EdgeRuntime not available in non-Supabase environments — promise still runs
  }

  return {
    message: `${pipeline.title} resume has been triggered. Check Operations for progress.`,
    suggestions: ['Check pipeline results', 'What needs my approval?', 'Summarize this week'],
    invoked_action: {
      type: 'run_pipeline',
      pipeline: pipeline.id,
      status: PIPELINE_RUN_STATUS.RESUMED,
      run_id: waitingRun.id,
    },
  }
}

export async function resolveExplicitSchedulerRequest(params: ExplicitSchedulerParams): Promise<ChatResponse | null> {
  const { supabase, orgId, message, confirmationAction, runs } = params

  const directPipeline = confirmationAction ? inferPipelineTarget(confirmationAction) : null
  const requestedPipeline = inferPipelineTarget(message)
  const isExplicitConfirm = /^confirm\b/i.test(message)
  const isExplicitCancel = /^cancel\b/i.test(message)
  // Calendar-create signals: "schedule a campaign for X on [date]" or "for X on [date] and run"
  // These must go to the LLM so it can choose create_calendar_event, not be intercepted here.
  const isCalendarCreateSignal =
    /\bschedule\b.+\bfor\b.+\bon\b.+\d/i.test(message) ||
    /\bfor\b.+\bon\b.+\d.+\b(run|pipeline)\b/i.test(message)
  const isRunRequest = Boolean(requestedPipeline) && /\b(run|start|trigger|launch|execute)\b/i.test(message) && !isCalendarCreateSignal
  const isResumeRequest = Boolean(requestedPipeline) && /\b(resume|continue)\b/i.test(message)
  const isStatusRequest = Boolean(requestedPipeline) && /\b(status|results?|running|logs?)\b/i.test(message)

  if (isStatusRequest && requestedPipeline) {
    const latestRun = getLatestPipelineRun(runs, requestedPipeline.id)
    return formatPipelineStatusResponse(requestedPipeline, latestRun)
  }

  if (isResumeRequest && requestedPipeline) {
    return await resumePipelineRun(supabase, requestedPipeline, orgId, runs)
  }

  if (isRunRequest && requestedPipeline && !isExplicitConfirm) {
    return await schedulePipelineRun(supabase, requestedPipeline, orgId, runs)
  }

  if (isExplicitCancel) {
    return {
      message: 'Understood. I have not triggered anything. If you want, I can still summarize the current state or prepare the next run for review.',
      suggestions: ['Summarize this week', 'What needs my approval?', 'What is next on the calendar?'],
    }
  }

  if (isExplicitConfirm && directPipeline) {
    return await schedulePipelineRun(supabase, directPipeline, orgId, runs)
  }

  return null
}

export async function resolveModelPipelineAction(params: ModelSchedulerParams): Promise<ChatResponse | null> {
  const { supabase, orgId, runs, action, fallbackMessage, suggestions } = params

  if (!action || action.type !== 'run_pipeline' || !action.pipeline) {
    return null
  }

  if (action.needs_confirmation === false) {
    const scheduled = await schedulePipelineRun(supabase, {
      id: action.pipeline,
      title: action.title ?? action.pipeline,
      description: action.description ?? '',
    }, orgId, runs)

    return {
      message: fallbackMessage || scheduled.message,
      suggestions,
      invoked_action: scheduled.invoked_action,
    }
  }

  return {
    message: fallbackMessage || 'I can do that next.',
    suggestions,
    confirmation: {
      title: action.title ?? action.pipeline,
      description: action.description ?? '',
      action: action.pipeline,
    },
  }
}
