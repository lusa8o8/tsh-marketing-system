// supabase/functions/pipeline-c-campaign/index.ts
// ─────────────────────────────────────────────────────────────────────
// Pipeline C — Campaign & Monthly Engine
// Triggered by coordinator when a calendar event hits its lead window
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { getAgentDefinition } from '../_shared/agent-registry.ts'
import { getIntegrationDefinition } from '../_shared/integration-registry.ts'
import { PIPELINE_RUN_STATUS } from '../_shared/pipeline-run-status.ts'

// ── types ─────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string
  event_type: string
  event_date: string
  event_end_date: string | null
  label: string
  universities: string[]
  lead_days: number
}

interface PipelineContext {
  orgId: string
  today: string
  calendarEvent?: CalendarEvent
}

interface PipelineCResults {
  research_completed: boolean
  campaign_brief_sent: boolean
  campaign_name: string
  copy_assets_created: number
  design_brief_sent: boolean
  posts_scheduled: number
  monitor_check_run: boolean
  report_generated: boolean
  errors: string[]
  campaign_brief_inbox_id?: string | null
  campaign_brief?: CampaignBrief | null
  calendar_event?: CalendarEvent | null
}

interface CampaignBrief {
  name: string
  goal: string
  target_audience: string
  universities: string[]
  duration_days: number
  platforms: string[]
  key_message: string
  call_to_action: string
  content_needed: string[]
  expected_signups: number
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
    calendarEvent: payload?.calendarEvent ?? {
      id: 'demo-event',
      event_type: 'exam_window',
      event_date: '2026-05-11',
      event_end_date: '2026-05-29',
      label: 'UNZA semester 1 exams 2026',
      universities: ['UNZA'],
      lead_days: 21
    }
  }

  const resumeRunId = typeof payload?.resume_run_id === 'string'
    ? payload.resume_run_id
    : typeof payload?.resumeRunId === 'string'
      ? payload.resumeRunId
      : null

  const config = await getOrgConfig(supabase, context.orgId)

  if (resumeRunId) {
    return await resumePipelineCRun({ supabase, anthropic, context, config, runId: resumeRunId })
  }

  let runId: string | null = null
  const results: PipelineCResults = {
    research_completed: false,
    campaign_brief_sent: false,
    campaign_name: '',
    copy_assets_created: 0,
    design_brief_sent: false,
    posts_scheduled: 0,
    monitor_check_run: false,
    report_generated: false,
    errors: [],
    campaign_brief_inbox_id: null,
    campaign_brief: null,
    calendar_event: context.calendarEvent ?? null
  }

  try {
    runId = await createPipelineCRun(supabase, context.orgId)

    const event = context.calendarEvent
    if (!event) {
      throw new Error('No calendar event provided — Pipeline C requires a trigger event')
    }

    console.log(`Pipeline C triggered for: ${event.label}`)

    // ── PARALLEL RESEARCH ─────────────────────────────────────────────
    console.log('Starting parallel research phase...')

    const [perfResult, competitorResult, ambassadorResult] = await Promise.all([
      runPerformanceAnalyser(supabase, anthropic, context),
      runCompetitorResearcher(anthropic, event),
      runAmbassadorReporter(supabase, context)
    ])

    results.research_completed = true
    console.log('Research phase complete')

    // ── SEQUENTIAL: campaign planner ──────────────────────────────────
    console.log('Running campaign planner...')

    const campaignBrief = await runCampaignPlanner(
      anthropic,
      event,
      perfResult,
      competitorResult,
      ambassadorResult,
      context.today
    )

    results.campaign_name = campaignBrief.name

    const { data: inboxRow } = await supabase
      .from('human_inbox')
      .insert({
        org_id: context.orgId,
        item_type: 'campaign_brief',
        priority: 'urgent',
        payload: {
          campaign_brief: campaignBrief,
          event_label: event.label,
          event_date: event.event_date,
          universities: event.universities,
          research_summary: {
            performance: perfResult.summary,
            competitor_insights: competitorResult.insights,
            ambassador_count: ambassadorResult.active_count
          },
          pipeline_run_id: runId
        },
        created_by_pipeline: 'pipeline-c-campaign',
        created_by_agent: getAgentDefinition('campaign_planner').id,
        expires_at: addDays(context.today, 3)
      })
      .select('id')
      .single()

    results.campaign_brief_sent = true
    results.campaign_name = campaignBrief.name
    results.campaign_brief = campaignBrief
    results.campaign_brief_inbox_id = inboxRow?.id ?? null
    console.log(`Campaign brief sent to CEO inbox: "${campaignBrief.name}"`)

    await updatePipelineCRun(
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
    await updatePipelineCRun(
      supabase,
      runId,
      PIPELINE_RUN_STATUS.FAILED,
      { ...results, error: message }
    )
    console.error('Pipeline C failed:', err)
    return new Response(
      JSON.stringify({ ok: false, error: message, run_id: runId, ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── performance analyser ──────────────────────────────────────────────
async function createPipelineCRun(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      org_id: orgId,
      pipeline: 'pipeline-c-campaign',
      status: PIPELINE_RUN_STATUS.RUNNING,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create Pipeline C run: ${error.message}`)
  return data?.id as string
}

async function loadPipelineCRun(supabase: any, orgId: string, runId: string) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('id', runId)
    .eq('org_id', orgId)
    .eq('pipeline', 'pipeline-c-campaign')
    .single()

  if (error) throw new Error(`Failed to load Pipeline C run: ${error.message}`)
  return data
}

async function updatePipelineCRun(supabase: any, runId: string | null, status: string, result: Record<string, unknown>) {
  if (!runId) return

  const patch: Record<string, unknown> = { status, result }

  if (status === PIPELINE_RUN_STATUS.SUCCESS || status === PIPELINE_RUN_STATUS.FAILED || status === PIPELINE_RUN_STATUS.CANCELLED) {
    patch.finished_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('pipeline_runs')
    .update(patch)
    .eq('id', runId)

  if (error) throw new Error(`Failed to update Pipeline C run: ${error.message}`)
}

async function resumePipelineCRun(params: { supabase: any; anthropic: Anthropic; context: PipelineContext; config: any; runId: string }) {
  const { supabase, anthropic, context, config, runId } = params
  const run = await loadPipelineCRun(supabase, context.orgId, runId)

  if (run.status === PIPELINE_RUN_STATUS.SUCCESS || run.status === PIPELINE_RUN_STATUS.CANCELLED) {
    return new Response(JSON.stringify({ ok: true, already_final: true, run_id: runId, ...(run.result ?? {}) }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (run.status !== PIPELINE_RUN_STATUS.WAITING_HUMAN && run.status !== PIPELINE_RUN_STATUS.RESUMED) {
    return new Response(JSON.stringify({ ok: false, error: `Pipeline C run ${runId} is not resumable from status ${run.status}` }), { status: 409, headers: { 'Content-Type': 'application/json' } })
  }

  const stored = (run.result ?? {}) as Record<string, any>
  const results: PipelineCResults = {
    research_completed: stored.research_completed ?? false,
    campaign_brief_sent: stored.campaign_brief_sent ?? false,
    campaign_name: stored.campaign_name ?? '',
    copy_assets_created: stored.copy_assets_created ?? 0,
    design_brief_sent: stored.design_brief_sent ?? false,
    posts_scheduled: stored.posts_scheduled ?? 0,
    monitor_check_run: stored.monitor_check_run ?? false,
    report_generated: stored.report_generated ?? false,
    errors: Array.isArray(stored.errors) ? stored.errors : [],
    campaign_brief_inbox_id: stored.campaign_brief_inbox_id ?? null,
    campaign_brief: stored.campaign_brief ?? null,
    calendar_event: stored.calendar_event ?? context.calendarEvent ?? null
  }

  await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.RESUMED, results)

  try {
    const briefInboxId = results.campaign_brief_inbox_id
    if (!briefInboxId) throw new Error('Pipeline C cannot resume without a stored campaign brief inbox id')

    const { data: briefRow, error: briefError } = await supabase
      .from('human_inbox')
      .select('*')
      .eq('id', briefInboxId)
      .eq('org_id', context.orgId)
      .single()

    if (briefError) throw new Error(`Failed to load Pipeline C campaign brief approval: ${briefError.message}`)

    if (briefRow.status === 'pending') {
      await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.WAITING_HUMAN, results)
      return new Response(JSON.stringify({ ok: true, waiting_human: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (briefRow.status === 'rejected') {
      await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.CANCELLED, { ...results, error: 'Campaign brief was rejected' })
      return new Response(JSON.stringify({ ok: true, cancelled: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
    }

    const campaignBrief = results.campaign_brief
    const event = results.calendar_event
    if (!campaignBrief || !event) throw new Error('Pipeline C resume is missing stored campaign brief or calendar event context')

    console.log('Writing canonical campaign message...')
    const canonicalCopy = await runCanonicalCopyWriter(anthropic, campaignBrief, event, config.brand_voice)
    console.log(`Canonical message locked: "${canonicalCopy.headline}"`)

    console.log('Starting parallel asset creation...')

    const [copyAssets, designBrief] = await Promise.all([
      runCopyWriter(anthropic, campaignBrief, event, config.brand_voice, canonicalCopy),
      runDesignBriefAgent(anthropic, campaignBrief, event)
    ])

    results.copy_assets_created = copyAssets.length

    for (const asset of copyAssets) {
      await supabase
        .from('content_registry')
        .insert({
          org_id: context.orgId,
          platform: asset.platform,
          body: asset.body,
          subject_line: asset.subject_line ?? null,
          status: 'draft',
          is_campaign_post: true,
          campaign_name: campaignBrief.name,
          pipeline_run_id: runId,
          scheduled_at: getScheduledTime(asset.day_offset, context.today),
          created_by: 'pipeline-c-campaign'
        })
    }

    await supabase.from('human_inbox').insert({
      org_id: context.orgId,
      item_type: 'suggestion',
      priority: 'normal',
      payload: { type: 'design_brief', campaign_name: campaignBrief.name, brief: designBrief },
      created_by_pipeline: 'pipeline-c-campaign',
      created_by_agent: getAgentDefinition('design_brief_agent').id
    })

    results.design_brief_sent = true
    console.log(`${copyAssets.length} copy assets landed in Content Registry as drafts`)
    console.log('Design brief sent to human inbox')

    console.log('Running campaign monitor check...')
    await runMonitor(supabase, anthropic, context, campaignBrief, config.kpi_targets)
    results.monitor_check_run = true

    console.log('Generating post-campaign report...')
    await runPostCampaignReport(supabase, anthropic, context, campaignBrief, results)
    results.report_generated = true

    await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.SUCCESS, results)
    return new Response(JSON.stringify({ ok: true, resumed: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.errors.push(message)
    await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.FAILED, { ...results, error: message })
    return new Response(JSON.stringify({ ok: false, error: message, run_id: runId, ...results }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

async function runPerformanceAnalyser(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext
) {
  const { data: metrics } = await supabase
    .from('platform_metrics')
    .select('*')
    .eq('org_id', context.orgId)
    .order('snapshot_date', { ascending: false })
    .limit(8)

  const { data: recentPosts } = await supabase
    .from('content_registry')
    .select('platform, body, reach, engagement, published_at')
    .eq('org_id', context.orgId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(10)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `Analyse TSH marketing performance data and provide a brief summary.
Respond with JSON: { "summary": "...", "top_platform": "...", "key_insight": "..." }`,
    messages: [{
      role: 'user',
      content: `Metrics: ${JSON.stringify(metrics?.slice(0, 4))}
Recent posts: ${JSON.stringify(recentPosts?.slice(0, 5))}`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(extractJSON(raw))
}

// ── competitor researcher ─────────────────────────────────────────────
async function runCompetitorResearcher(
  anthropic: Anthropic,
  event: CalendarEvent
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: `You are a competitor research analyst for an EdTech company in Zambia.
Provide mock competitor insights for campaign planning.
Respond with JSON: { "insights": "...", "opportunity": "..." }`,
    messages: [{
      role: 'user',
      content: `Event: ${event.label}
Universities: ${event.universities.join(', ')}
Event type: ${event.event_type}

What are competitors likely doing and what opportunity exists for TSH?`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(extractJSON(raw))
}

// ── ambassador reporter ───────────────────────────────────────────────
async function runAmbassadorReporter(supabase: any, context: PipelineContext) {
  const { data: ambassadors } = await supabase
    .from('ambassador_registry')
    .select('*')
    .eq('org_id', context.orgId)

  const active = (ambassadors ?? []).filter((a: any) => a.status === 'active')
  const flagged = (ambassadors ?? []).filter((a: any) => a.status === 'flagged')

  return {
    active_count: active.length,
    flagged_count: flagged.length,
    universities_covered: [...new Set(active.map((a: any) => a.university))],
    summary: `${active.length} active ambassadors across ${[...new Set(active.map((a: any) => a.university))].length} universities`
  }
}

// ── campaign planner ──────────────────────────────────────────────────
async function runCampaignPlanner(
  anthropic: Anthropic,
  event: CalendarEvent,
  perfData: any,
  competitorData: any,
  ambassadorData: any,
  today: string
): Promise<CampaignBrief> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: `You are the campaign strategist for TSH (Transcended Study Hub).
TSH helps Zambian university students pass exams through YouTube tutorials and StudyHub past papers.

Create a focused campaign brief for the upcoming academic event.
Respond with JSON only matching this structure exactly:
{
  "name": "campaign name",
  "goal": "specific measurable goal",
  "target_audience": "description",
  "universities": ["array"],
  "duration_days": number,
  "platforms": ["facebook","whatsapp","youtube","email"],
  "key_message": "core message in one sentence",
  "call_to_action": "exactly what students should do",
  "content_needed": ["list of content pieces needed"],
  "expected_signups": number
}`,
    messages: [{
      role: 'user',
      content: `Triggering event: ${event.label}
Event date: ${event.event_date}
Universities: ${event.universities.join(', ')}
Days until event: ${Math.ceil((new Date(event.event_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))}

Performance context: ${JSON.stringify(perfData)}
Competitor opportunity: ${JSON.stringify(competitorData)}
Ambassador coverage: ${JSON.stringify(ambassadorData)}

Create the campaign brief.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(extractJSON(raw))
}

// ── canonical copy writer ─────────────────────────────────────────────
// Phase 1: produces the verbatim source-of-truth message for the campaign.
// All platform adapters in phase 2 must use these fields exactly as written.
async function runCanonicalCopyWriter(
  anthropic: Anthropic,
  brief: CampaignBrief,
  event: CalendarEvent,
  brandVoice: any
): Promise<{ headline: string; core_body: string; exact_cta: string; key_fact: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `${buildSystemPrompt(brandVoice)}

You are writing the canonical campaign message that will be adapted across all platforms.
Distil the single most important message from the brief into its purest form.
Respond with JSON only:
{
  "headline": "the hook or opening line to use verbatim across all platforms",
  "core_body": "2-3 sentences that explain the offer and why it matters",
  "exact_cta": "the exact call-to-action text to use verbatim on every platform",
  "key_fact": "the single most important date, stat, or offer detail to include everywhere"
}`,
    messages: [{
      role: 'user',
      content: `Campaign: ${brief.name}
Goal: ${brief.goal}
Key message: ${brief.key_message}
Call to action: ${brief.call_to_action}
Target: ${event.universities.join(', ')} students
Event date: ${event.event_date}
Duration: ${brief.duration_days} days

Write the canonical campaign message now.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(extractJSON(raw))
}

// ── copy writer ───────────────────────────────────────────────────────
// Phase 2: adapts the canonical message for each platform in parallel.
// Platform adapters may change format, length, and tone only.
// headline, exact_cta, and key_fact must appear verbatim in every asset.
async function runCopyWriter(
  anthropic: Anthropic,
  brief: CampaignBrief,
  event: CalendarEvent,
  brandVoice: any,
  canonical: { headline: string; core_body: string; exact_cta: string; key_fact: string }
): Promise<any[]> {

  const platforms = [
    { platform: getIntegrationDefinition('facebook').id, instruction: '2-3 sentences, emoji ok, end with StudyHub link' },
    { platform: getIntegrationDefinition('facebook').id, instruction: 'focus on social proof or urgency — different framing from the first post, same core message' },
    { platform: getIntegrationDefinition('whatsapp').id, instruction: 'under 200 characters, conversational, one clear call to action' },
    { platform: getIntegrationDefinition('youtube').id, instruction: 'short community post, ask a question to drive comments' },
    { platform: getIntegrationDefinition('email').id, instruction: 'start first line with Subject: then write email body, warm and helpful' },
    { platform: getIntegrationDefinition('whatsapp').id, instruction: 'ambassador talking points — bullet list of what to say to classmates' },
  ]

  const results = await Promise.all(
    platforms.map(async (p, index) => {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 200,
          system: `${buildSystemPrompt(brandVoice)}

Write ONLY the post copy — no JSON, no quotes around it, no preamble.

You MUST include these campaign elements verbatim — do not paraphrase or reinterpret them:
- Opening headline: "${canonical.headline}"
- Call to action: "${canonical.exact_cta}"
- Key fact: "${canonical.key_fact}"

Adapt the surrounding format, length, and tone for the platform only.`,
          messages: [{
            role: 'user',
            content: `Campaign: ${brief.name}
Core message: ${canonical.core_body}
Target: ${event.universities.join(', ')} students
Event date: ${event.event_date}
Platform: ${p.platform}
Instructions: ${p.instruction}

Write the copy now.`
          }]
        })

        const body = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : ''

        let subject_line: string | undefined
        let postBody = body

        if (p.platform === 'email' && body.startsWith('Subject:')) {
          const lines = body.split('\n')
          subject_line = lines[0].replace('Subject:', '').trim()
          postBody = lines.slice(1).join('\n').trim()
        }

        return {
          platform: p.platform,
          day_offset: index,
          body: postBody,
          subject_line,
          type: 'campaign'
        }
      } catch (err) {
        console.error(`Copy writer failed for ${p.platform}:`, err instanceof Error ? err.message : String(err))
        return null
      }
    })
  )

  return results.filter((a): a is NonNullable<typeof a> => a !== null)
}

// ── design brief agent ────────────────────────────────────────────────
async function runDesignBriefAgent(
  anthropic: Anthropic,
  brief: CampaignBrief,
  event: CalendarEvent
): Promise<string> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `Write a concise design brief for a student-focused EdTech campaign flyer.
Plain text, bullet points, under 150 words.`,
    messages: [{
      role: 'user',
      content: `Campaign: ${brief.name}
Key message: ${brief.key_message}
Platforms: ${brief.platforms.join(', ')}
Target: ${brief.target_audience} at ${event.universities.join(', ')}

Write the design brief for the graphic designer.`
    }]
  })

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Design brief unavailable.'
}

// ── monitor ───────────────────────────────────────────────────────────
async function runMonitor(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  brief: CampaignBrief,
  kpiTargets: any
) {
  const { data: campaignPosts } = await supabase
    .from('content_registry')
    .select('platform, body, reach, engagement, status, published_at')
    .eq('org_id', context.orgId)
    .eq('is_campaign_post', true)
    .order('published_at', { ascending: false })
    .limit(10)

  const { data: metrics } = await supabase
    .from('platform_metrics')
    .select('*')
    .eq('org_id', context.orgId)
    .order('snapshot_date', { ascending: false })
    .limit(4)

  // Use kpi_targets.weekly_signups as the benchmark instead of hardcoded expected_signups
  const weeklySignupBenchmark = kpiTargets?.weekly_signups ?? brief.expected_signups

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: `Analyse campaign performance and flag if intervention needed.
Respond with JSON: { "status": "on_track|underperforming", "insight": "...", "action": "none|escalate" }`,
    messages: [{
      role: 'user',
      content: `Campaign goal: ${brief.goal}
Weekly signup benchmark (from KPI targets): ${weeklySignupBenchmark}
Expected campaign signups: ${brief.expected_signups}
Current metrics: ${JSON.stringify(metrics?.slice(0, 4))}
Campaign posts: ${JSON.stringify(campaignPosts?.slice(0, 5))}`
    }]
  })

  const analysis = JSON.parse(extractJSON(response.content[0].type === 'text' ? response.content[0].text : '{}'))

  console.log(`Monitor: campaign ${analysis.status} — ${analysis.insight}`)

  if (analysis.action === 'escalate') {
    await supabase.from('human_inbox').insert({
      org_id: context.orgId,
      item_type: 'suggestion',
      priority: 'urgent',
      payload: {
        type: 'campaign_underperforming',
        campaign_name: brief.name,
        weekly_signup_benchmark: weeklySignupBenchmark,
        insight: analysis.insight,
        suggestion: 'Consider adjusting the campaign messaging or boosting with paid ads'
      },
      created_by_pipeline: 'pipeline-c-campaign',
      created_by_agent: getAgentDefinition('monitor').id
    })
    console.log('Monitor: escalation sent to human inbox')
  }
}

// ── post-campaign report ──────────────────────────────────────────────
async function runPostCampaignReport(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  brief: CampaignBrief,
  pipelineResults: any
) {
  const { data: metrics } = await supabase
    .from('platform_metrics')
    .select('*')
    .eq('org_id', context.orgId)
    .order('snapshot_date', { ascending: false })
    .limit(4)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    system: `Write a concise post-campaign report for the CEO of TSH.
Plain text, under 200 words. Cover: what ran, results vs goal, key lesson, recommendation.`,
    messages: [{
      role: 'user',
      content: `Campaign: ${brief.name}
Goal: ${brief.goal}
Expected signups: ${brief.expected_signups}
Posts scheduled: ${pipelineResults.posts_scheduled}
Copy assets created: ${pipelineResults.copy_assets_created}
Current platform metrics: ${JSON.stringify(metrics?.slice(0, 4))}`
    }]
  })

  const reportText = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Campaign report unavailable.'

  await supabase.from('human_inbox').insert({
    org_id: context.orgId,
    item_type: 'campaign_report',
    priority: 'fyi',
    payload: {
      campaign_name: brief.name,
      report: reportText,
      brief_summary: brief,
      pipeline_results: pipelineResults
    },
    created_by_pipeline: 'pipeline-c-campaign',
    created_by_agent: getAgentDefinition('post_campaign_reporter').id
  })

  console.log('Post-campaign report sent to CEO inbox')
}

// ── helpers ───────────────────────────────────────────────────────────
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getScheduledTime(dayOffset: number, today: string): string {
  const d = new Date(today)
  d.setDate(d.getDate() + (dayOffset || 0))
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}
