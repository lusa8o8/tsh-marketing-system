// supabase/functions/pipeline-b-weekly/index.ts
// ─────────────────────────────────────────────────────────────────────
// Pipeline B — Weekly Publishing Engine
// Runs on the configured run_day, invoked by the coordinator
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { getAgentDefinition } from '../_shared/agent-registry.ts'
import { getIntegrationDefinition } from '../_shared/integration-registry.ts'
import { PIPELINE_RUN_STATUS } from '../_shared/pipeline-run-status.ts'

// ── types ─────────────────────────────────────────────────────────────
interface NewContent {
  id: string
  type: 'youtube_video' | 'studyhub_resource'
  title: string
  description: string
  url: string
  subject: string
  university_relevance: string[]
}

interface WeeklyPost {
  platform: 'facebook' | 'whatsapp' | 'youtube' | 'email'
  body: string
  subject_line?: string
  content_source?: string
  scheduled_day: string
}

interface PipelineContext {
  orgId: string
  today: string
  calendarEvents?: any[]
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

// ── brand voice prompt builder ────────────────────────────────────────
function buildSystemPrompt(brandVoice: any): string {
  return `You are the social media voice for ${brandVoice.full_name} (${brandVoice.name}).
${brandVoice.full_name} helps Zambian university students pass exams through YouTube tutorials and past papers.
Target audience: ${brandVoice.target_audience}
Tone: ${brandVoice.tone}
Always: ${brandVoice.always_say.join(', ')}
Never: ${brandVoice.never_say.join(', ')}
Preferred CTA: ${brandVoice.cta_preference}
Good post example: "${brandVoice.example_good_post}"
Bad post example: "${brandVoice.example_bad_post}"`
}

// ── JSON extractor — handles markdown code fences safely ──────────────
function extractJSON(text: string, fallback: string = '{}'): string {
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
    return fallback
  } catch {
    return fallback
  }
}

// ── mock new content feed ─────────────────────────────────────────────
function getMockNewContent(): NewContent[] {
  return [
    {
      id: 'yt_new_001',
      type: 'youtube_video',
      title: 'How to Ace Organic Chemistry — Full UNZA Exam Breakdown',
      description: 'Complete walkthrough of the most common organic chemistry exam questions at UNZA and CBU.',
      url: 'https://youtube.com/watch?v=example1',
      subject: 'Chemistry',
      university_relevance: ['UNZA', 'CBU', 'MU']
    },
    {
      id: 'yt_new_002',
      type: 'youtube_video',
      title: 'Statistics Made Simple — Probability & Distributions',
      description: 'Step by step guide to probability distributions and hypothesis testing.',
      url: 'https://youtube.com/watch?v=example2',
      subject: 'Statistics',
      university_relevance: ['UNZA', 'ZCAS', 'CBU']
    },
    {
      id: 'sh_new_001',
      type: 'studyhub_resource',
      title: 'UNZA Past Papers Pack — Economics 2019–2024',
      description: '5 years of UNZA Economics past papers with detailed model answers.',
      url: 'https://studyhub.com/resources/unza-economics-past-papers',
      subject: 'Economics',
      university_relevance: ['UNZA']
    }
  ]
}

// ── main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const anthropic = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
  })

  const payload = await req.json().catch(() => ({}))
  const context: PipelineContext = {
    orgId: payload?.orgId ?? payload?.org_id ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    today: payload?.today ?? new Date().toISOString().split('T')[0],
    calendarEvents: Array.isArray(payload?.calendarEvents) ? payload.calendarEvents : undefined
  }

  const resumeRunId = typeof payload?.resume_run_id === 'string'
    ? payload.resume_run_id
    : typeof payload?.resumeRunId === 'string'
      ? payload.resumeRunId
      : null

  const config = await getOrgConfig(supabase, context.orgId)

  if (resumeRunId) {
    return await resumePipelineBRun({ supabase, anthropic, context, config, runId: resumeRunId })
  }

  let runId: string | null = null
  const results = {
    content_items_found: 0,
    posts_drafted: 0,
    drafts_sent_for_approval: 0,
    posts_published: 0,
    ambassador_update_sent: false,
    report_generated: false,
    errors: [] as string[],
    draft_content_ids: [] as string[]
  }

  try {
    runId = await createPipelineBRun(supabase, context.orgId)

    console.log('Starting parallel fetch phase...')

    const [metricsResult, calendarResult, contentResult] = await Promise.all([
      supabase
        .from('platform_metrics')
        .select('*')
        .eq('org_id', context.orgId)
        .order('snapshot_date', { ascending: false })
        .limit(8),

      supabase
        .from('academic_calendar')
        .select('*')
        .eq('org_id', context.orgId)
        .eq('triggered', false)
        .gte('event_date', context.today)
        .lte('event_date', addDays(context.today, 21))
        .order('event_date', { ascending: true }),

      Promise.resolve({ data: getMockNewContent(), error: null })
    ])

    const lastWeekMetrics = metricsResult.data ?? []
    const upcomingEvents = calendarResult.data ?? []
    const newContent = contentResult.data ?? []

    results.content_items_found = newContent.length
    console.log(`Fetched: ${lastWeekMetrics.length} metric rows, ${upcomingEvents.length} upcoming events, ${newContent.length} new content items`)

    console.log('Running plan agent...')
    const weeklyPlan = await runPlanAgent(
      anthropic,
      lastWeekMetrics,
      upcomingEvents,
      newContent,
      context.today,
      config.posting_limits
    )
    console.log(`Plan created: ${weeklyPlan.length} posts planned`)

    console.log('Running copy writer...')
    const draftedPosts: WeeklyPost[] = []

    for (const planItem of weeklyPlan) {
      const post = await runCopyWriter(anthropic, planItem, newContent, config.brand_voice)
      draftedPosts.push(post)
      results.posts_drafted++
    }

    console.log('Sending drafts to Content Registry for approval...')

    for (const post of draftedPosts) {
      const { data: registryRow } = await supabase
        .from('content_registry')
        .insert({
          org_id: context.orgId,
          platform: post.platform,
          body: post.body,
          subject_line: post.subject_line ?? null,
          status: 'draft',
          pipeline_run_id: runId,
          scheduled_at: getScheduledTime(post.scheduled_day, context.today),
          created_by: 'pipeline-b-weekly'
        })
        .select('id')
        .single()

      if (registryRow?.id) {
        results.draft_content_ids.push(registryRow.id)
      }

      results.drafts_sent_for_approval++
    }

    console.log(`${results.drafts_sent_for_approval} drafts sent to Content Registry`)

    await updatePipelineBRun(
      supabase,
      runId,
      PIPELINE_RUN_STATUS.WAITING_HUMAN,
      results
    )

    return new Response(
      JSON.stringify({ ok: true, waiting_human: true, run_id: runId, ...results }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.errors.push(message)
    await updatePipelineBRun(
      supabase,
      runId,
      PIPELINE_RUN_STATUS.FAILED,
      { ...results, error: message }
    )
    console.error('Pipeline B failed:', err)
    return new Response(
      JSON.stringify({ ok: false, error: message, run_id: runId, ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function createPipelineBRun(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      org_id: orgId,
      pipeline: 'pipeline-b-weekly',
      status: PIPELINE_RUN_STATUS.RUNNING,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create Pipeline B run: ${error.message}`)
  return data?.id as string
}

async function loadPipelineBRun(supabase: any, orgId: string, runId: string) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('id', runId)
    .eq('org_id', orgId)
    .eq('pipeline', 'pipeline-b-weekly')
    .single()

  if (error) throw new Error(`Failed to load Pipeline B run: ${error.message}`)
  return data
}

async function updatePipelineBRun(
  supabase: any,
  runId: string,
  status: string,
  result: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    status,
    result,
  }

  if (
    status === PIPELINE_RUN_STATUS.SUCCESS
    || status === PIPELINE_RUN_STATUS.FAILED
    || status === PIPELINE_RUN_STATUS.CANCELLED
  ) {
    patch.finished_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('pipeline_runs')
    .update(patch)
    .eq('id', runId)

  if (error) throw new Error(`Failed to update Pipeline B run: ${error.message}`)
}

async function resumePipelineBRun(params: {
  supabase: any
  anthropic: Anthropic
  context: PipelineContext
  config: any
  runId: string
}) {
  const { supabase, anthropic, context, config, runId } = params
  const run = await loadPipelineBRun(supabase, context.orgId, runId)

  if (run.status === PIPELINE_RUN_STATUS.SUCCESS || run.status === PIPELINE_RUN_STATUS.CANCELLED) {
    return new Response(
      JSON.stringify({ ok: true, already_final: true, run_id: runId, ...(run.result ?? {}) }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (run.status !== PIPELINE_RUN_STATUS.WAITING_HUMAN && run.status !== PIPELINE_RUN_STATUS.RESUMED) {
    return new Response(
      JSON.stringify({ ok: false, error: `Pipeline B run ${runId} is not resumable from status ${run.status}` }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stored = (run.result ?? {}) as Record<string, any>
  const results = {
    content_items_found: stored.content_items_found ?? 0,
    posts_drafted: stored.posts_drafted ?? 0,
    drafts_sent_for_approval: stored.drafts_sent_for_approval ?? 0,
    posts_published: stored.posts_published ?? 0,
    ambassador_update_sent: stored.ambassador_update_sent ?? false,
    report_generated: stored.report_generated ?? false,
    errors: Array.isArray(stored.errors) ? stored.errors : [],
    draft_content_ids: Array.isArray(stored.draft_content_ids) ? stored.draft_content_ids : []
  }

  await updatePipelineBRun(
    supabase,
    runId,
    PIPELINE_RUN_STATUS.RESUMED,
    results
  )

  try {
    const { data: draftRows, error: draftsError } = await supabase
      .from('content_registry')
      .select('*')
      .eq('org_id', context.orgId)
      .in('id', results.draft_content_ids)

    if (draftsError) throw new Error(`Failed to load Pipeline B drafts: ${draftsError.message}`)

    const drafts = draftRows ?? []
    const pendingDrafts = drafts.filter((row: any) => row.status === 'draft')
    if (pendingDrafts.length > 0) {
      await updatePipelineBRun(
        supabase,
        runId,
        PIPELINE_RUN_STATUS.WAITING_HUMAN,
        results
      )

      return new Response(
        JSON.stringify({ ok: true, waiting_human: true, pending_drafts: pendingDrafts.length, run_id: runId, ...results }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const approvedDrafts = drafts.filter((row: any) => row.status === 'scheduled' || row.status === 'approved')
    if (approvedDrafts.length === 0) {
      await updatePipelineBRun(
        supabase,
        runId,
        PIPELINE_RUN_STATUS.CANCELLED,
        results
      )

      return new Response(
        JSON.stringify({ ok: true, cancelled: true, run_id: runId, ...results }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: lastWeekMetrics, error: metricsError } = await supabase
      .from('platform_metrics')
      .select('*')
      .eq('org_id', context.orgId)
      .order('snapshot_date', { ascending: false })
      .limit(8)

    if (metricsError) throw new Error(`Failed to reload metrics for Pipeline B resume: ${metricsError.message}`)

    const now = Date.now()
    const duePosts = approvedDrafts.filter((row: any) => !row.scheduled_at || new Date(row.scheduled_at).getTime() <= now)
    for (const post of duePosts) {
      await supabase
        .from('content_registry')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', post.id)
      results.posts_published += 1
    }

    if (!results.ambassador_update_sent) {
      await runAmbassadorUpdate(supabase, anthropic, context, getMockNewContent(), config.brand_voice)
      results.ambassador_update_sent = true
    }

    if (!results.report_generated) {
      await runReporter(supabase, anthropic, context, lastWeekMetrics ?? [], results)
      results.report_generated = true
    }

    await updatePipelineBRun(
      supabase,
      runId,
      PIPELINE_RUN_STATUS.SUCCESS,
      results
    )

    return new Response(
      JSON.stringify({ ok: true, resumed: true, run_id: runId, ...results }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.errors.push(message)
    await updatePipelineBRun(
      supabase,
      runId,
      PIPELINE_RUN_STATUS.FAILED,
      { ...results, error: message }
    )

    return new Response(
      JSON.stringify({ ok: false, error: message, run_id: runId, ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// plan agent ────────────────────────────────────────────────────────
async function runPlanAgent(
  anthropic: Anthropic,
  metrics: any[],
  upcomingEvents: any[],
  newContent: NewContent[],
  today: string,
  postingLimits: any
): Promise<any[]> {

  const limitsStr = postingLimits
    ? `Weekly posting limits per platform: ${JSON.stringify(postingLimits)}`
    : 'Default: plan 5 posts across platforms.'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: `You are the weekly content planner for TSH (Transcended Study Hub).
TSH helps Zambian university students pass exams via YouTube tutorials and StudyHub past papers.

${limitsStr}

Respond with JSON only — an array of plan items:
[
  {
    "platform": "facebook|whatsapp|youtube|email",
    "content_id": "id of the new content to feature, or null for original",
    "angle": "what angle or hook to use",
    "scheduled_day": "monday|tuesday|wednesday|thursday|friday",
    "goal": "awareness|trust|action|loyalty"
  }
]`,
    messages: [{
      role: 'user',
      content: `Today: ${today}

New content available:
${JSON.stringify(newContent, null, 2)}

Upcoming events (next 21 days):
${JSON.stringify(upcomingEvents.map(e => ({
  label: e.label,
  date: e.event_date,
  type: e.event_type,
  universities: e.universities
})), null, 2)}

Last week metrics:
${JSON.stringify(metrics.slice(0, 4).map(m => ({
  platform: m.platform,
  engagement: m.engagement,
  reach: m.post_reach
})), null, 2)}

Create this week's content plan.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    return JSON.parse(extractJSON(raw, '[]'))
  } catch (e) {
    console.error('Plan agent JSON parse failed:', e)
    return []
  }
}

// ── copy writer ───────────────────────────────────────────────────────
async function runCopyWriter(
  anthropic: Anthropic,
  planItem: any,
  newContent: NewContent[],
  brandVoice: any
): Promise<WeeklyPost> {

  const featuredContent = newContent.find(c => c.id === planItem.content_id)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `${buildSystemPrompt(brandVoice)}

For email: include a subject line on the first line starting with "Subject: "
For WhatsApp: keep under 200 characters, conversational
For Facebook: 2-3 sentences, engaging hook, emoji ok
For YouTube community: short, drives comments

Write the post copy only — no preamble.`,
    messages: [{
      role: 'user',
      content: `Write a ${planItem.platform} post.
Goal: ${planItem.goal}
Angle: ${planItem.angle}
Scheduled: ${planItem.scheduled_day}
${featuredContent
  ? `Featured content:\nTitle: ${featuredContent.title}\nURL: ${featuredContent.url}`
  : 'No specific content — write an original engagement post.'}`
    }]
  })

  const body = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : ''

  let subject_line: string | undefined
  let postBody = body
  if (planItem.platform === 'email' && body.startsWith('Subject: ')) {
    const lines = body.split('\n')
    subject_line = lines[0].replace('Subject: ', '').trim()
    postBody = lines.slice(1).join('\n').trim()
  }

  return {
    platform: planItem.platform,
    body: postBody,
    subject_line,
    content_source: featuredContent?.url,
    scheduled_day: planItem.scheduled_day
  }
}

// ── ambassador update ─────────────────────────────────────────────────
async function runAmbassadorUpdate(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  newContent: NewContent[],
  brandVoice: any
) {
  const { data: ambassadors } = await supabase
    .from('ambassador_registry')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('status', 'active')

  if (!ambassadors || ambassadors.length === 0) {
    console.log('No active ambassadors to update')
    return
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: `${buildSystemPrompt(brandVoice)}

Write a brief weekly update message for TSH student ambassadors.
Keep it energetic, under 150 words. Include new content to share and remind them to report weekly reach numbers.`,
    messages: [{
      role: 'user',
      content: `New content this week:\n${newContent.map(c => `- ${c.title} (${c.subject})`).join('\n')}\n\nWrite the ambassador update message.`
    }]
  })

  const updateMessage = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Hey TSH ambassadors! New content is live this week. Share it with your campus groups!'

  console.log(`Ambassador update drafted for ${ambassadors.length} ambassadors (mock send)`)

  await supabase.from('content_registry').insert({
    org_id: context.orgId,
    platform: getIntegrationDefinition('whatsapp').id,
    body: updateMessage,
    status: 'published',
    published_at: new Date().toISOString(),
    created_by: 'pipeline-b-ambassador-update'
  })

  for (const ambassador of ambassadors) {
    await supabase
      .from('ambassador_registry')
      .update({ last_content_sent: new Date().toISOString() })
      .eq('id', ambassador.id)
  }
}

// ── reporter ──────────────────────────────────────────────────────────
async function runReporter(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  metrics: any[],
  pipelineResults: any
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    system: `You write concise weekly marketing reports for the CEO of TSH.
Plain text, under 200 words. Cover: what was done, key numbers, what worked, what didn't, plan for next week.`,
    messages: [{
      role: 'user',
      content: `Week ending: ${context.today}
Posts drafted: ${pipelineResults.posts_drafted}
Drafts for approval: ${pipelineResults.drafts_sent_for_approval}
Published: ${pipelineResults.posts_published}
Ambassador update sent: ${pipelineResults.ambassador_update_sent}

Metrics:
${metrics.slice(0, 4).map((m: any) =>
  `${m.platform}: ${m.followers} followers, ${m.post_reach} reach, ${m.engagement} engagement, ${m.signups} sign-ups`
).join('\n')}

Write the weekly report.`
    }]
  })

  const reportText = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Weekly report unavailable.'

  await supabase.from('human_inbox').insert({
    org_id: context.orgId,
    item_type: 'weekly_report',
    priority: 'fyi',
    payload: {
      report: reportText,
      week_ending: context.today,
      metrics_snapshot: metrics.slice(0, 4),
      pipeline_results: pipelineResults
    },
    created_by_pipeline: 'pipeline-b-weekly',
    created_by_agent: getAgentDefinition('reporter').id
  })

  console.log('Weekly report sent to human inbox')
}

// ── helpers ───────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getScheduledTime(day: string, today: string): string {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const todayDate = new Date(today)
  const todayDay = todayDate.getDay()
  const targetDay = days.indexOf(day.toLowerCase())
  const daysUntil = (targetDay - todayDay + 7) % 7 || 7
  const scheduled = new Date(todayDate)
  scheduled.setDate(scheduled.getDate() + daysUntil)
  scheduled.setHours(9, 0, 0, 0)
  return scheduled.toISOString()
}
