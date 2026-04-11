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
  creative_override_allowed: boolean
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
  const hashtagLine = Array.isArray(brandVoice.hashtags) && brandVoice.hashtags.length > 0
    ? `\nApproved hashtags (use only these — do not invent others): ${brandVoice.hashtags.join(' ')}`
    : ''
  const formatLine = brandVoice.post_format_preference
    ? `\nPost format preference: ${brandVoice.post_format_preference}`
    : ''

  return `You are the social media voice for ${brandVoice.full_name} (${brandVoice.name}).
${brandVoice.full_name} helps Zambian university students pass exams through YouTube tutorials and past papers.
Target audience: ${brandVoice.target_audience}
Tone: ${brandVoice.tone}
Always: ${brandVoice.always_say.join(', ')}
Never: ${brandVoice.never_say.join(', ')}
Preferred CTA: ${brandVoice.cta_preference}
Good post example: "${brandVoice.example_good_post}"
Bad post example: "${brandVoice.example_bad_post}"${hashtagLine}${formatLine}`
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
  const orgId: string = payload?.orgId ?? payload?.org_id ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const today: string = payload?.today ?? new Date().toISOString().split('T')[0]

  const resumeRunId = typeof payload?.resume_run_id === 'string'
    ? payload.resume_run_id
    : typeof payload?.resumeRunId === 'string'
      ? payload.resumeRunId
      : null

  // Resolve the calendar event context:
  // 1. Use payload.calendarEvent if passed (NL calendar-triggered run)
  // 2. Query academic_calendar for the next upcoming event (standalone "run the campaign pipeline")
  // 3. Error — no upcoming event exists; do not silently fall back to a demo event
  let resolvedCalendarEvent: CalendarEvent | undefined
  if (payload?.calendarEvent) {
    resolvedCalendarEvent = payload.calendarEvent as CalendarEvent
  } else if (!resumeRunId) {
    // Only query for next event on a fresh run; resume uses the stored event from pipeline_runs.result
    resolvedCalendarEvent = await getNextCalendarEvent(supabase, orgId, today)
  }

  const context: PipelineContext = {
    orgId,
    today,
    calendarEvent: resolvedCalendarEvent,
  }

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

    // ── STAGE 2: marketer approval gate ───────────────────────────────
    // If copy assets have already been created, this is the second resume.
    // Check the state of all content_registry rows for this run.
    if (results.copy_assets_created > 0) {
      const { data: draftRows } = await supabase
        .from('content_registry')
        .select('id, status, platform, body, rejection_note')
        .eq('pipeline_run_id', runId)
        .eq('org_id', context.orgId)

      // Exclude design_brief — it is not a copy gate. Its approval status is independent
      // of the marketer review and must not block pipeline resume.
      const copyRows = (draftRows ?? []).filter((r: any) => r.platform !== 'design_brief')
      const rejected = copyRows.filter((r: any) => r.status === 'rejected')
      const stillDraft = copyRows.filter((r: any) => r.status === 'draft')

      if (rejected.length > 0) {
        // At least one draft was rejected — create revision request and pause
        const rejectionSummary = rejected.map((r: any) =>
          `${r.platform}: ${r.rejection_note ? `"${r.rejection_note}"` : 'no reason given'}`
        ).join('\n')

        await supabase.from('human_inbox').insert({
          org_id: context.orgId,
          item_type: 'suggestion',
          priority: 'urgent',
          payload: {
            title: `Revision requested — ${campaignBrief.name}`,
            preview: `${rejected.length} draft${rejected.length > 1 ? 's' : ''} rejected. Review the reasons and resubmit.`,
            type: 'revision_request',
            campaign_name: campaignBrief.name,
            rejected_count: rejected.length,
            rejection_summary: rejectionSummary,
            pipeline_run_id: runId,
          },
          created_by_pipeline: 'pipeline-c-campaign',
          created_by_agent: getAgentDefinition('copy_writer').id,
        })

        await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.WAITING_HUMAN, results)
        return new Response(JSON.stringify({ ok: true, waiting_human: true, revision_requested: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (stillDraft.length > 0) {
        // Not all approved yet — stay paused
        await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.WAITING_HUMAN, results)
        return new Response(JSON.stringify({ ok: true, waiting_human: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
      }

      // All drafts approved — run monitor and report
      console.log('All drafts approved — running monitor and post-campaign report...')
      await runMonitor(supabase, anthropic, context, campaignBrief, config.kpi_targets)
      results.monitor_check_run = true

      await runPostCampaignReport(supabase, anthropic, context, campaignBrief, results)
      results.report_generated = true

      await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.SUCCESS, results)
      return new Response(JSON.stringify({ ok: true, resumed: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ── STAGE 1: CEO brief approved — create copy assets and pause ────
    console.log('Writing canonical campaign message...')
    const canonicalCopy = await runCanonicalCopyWriter(anthropic, campaignBrief, event, config.brand_voice)
    console.log(`Canonical message locked: "${canonicalCopy.headline}"`)

    console.log('Starting parallel asset creation...')

    const [copyAssets, designBrief] = await Promise.all([
      runCopyWriter(anthropic, campaignBrief, event, config.brand_voice, canonicalCopy),
      runDesignBriefAgent(anthropic, campaignBrief, event, config.brand_visual ?? {}, config.markdown_design_spec ?? null)
    ])

    results.copy_assets_created = copyAssets.length

    for (let i = 0; i < copyAssets.length; i++) {
      const asset = copyAssets[i]
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
          scheduled_at: getScheduledTime(i, copyAssets.length, context.today, event.event_date),
          created_by: 'pipeline-c-campaign'
        })
    }

    const { error: briefInsertError } = await supabase.from('content_registry').insert({
      org_id: context.orgId,
      platform: 'design_brief',
      body: designBrief,
      status: 'draft',
      is_campaign_post: true,
      campaign_name: campaignBrief.name,
      pipeline_run_id: runId,
      created_by: 'pipeline-c-campaign'
    })

    if (briefInsertError) {
      console.error('Design brief insert failed:', briefInsertError)
      results.errors.push(`design_brief insert: ${briefInsertError.message}`)
    } else {
      results.design_brief_sent = true
    }
    console.log(`${copyAssets.length} copy assets landed in Content Registry as drafts — waiting for marketer approval`)

    // Pause here — monitor and report run only after marketer approves all drafts (stage 2)
    await updatePipelineCRun(supabase, runId, PIPELINE_RUN_STATUS.WAITING_HUMAN, results)
    return new Response(JSON.stringify({ ok: true, waiting_human: true, marketer_gate: true, run_id: runId, ...results }), { headers: { 'Content-Type': 'application/json' } })
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
// NOTE: competitor insights are simulated (no live web data source yet).
// The brief payload includes competitor_insights_source: 'simulated' so the
// CEO reviewing the brief can see this clearly. Replace with real data in M-vision.
async function runCompetitorResearcher(
  anthropic: Anthropic,
  event: CalendarEvent
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: `You are a competitor research analyst for an EdTech company in Zambia.
Provide plausible competitor insights for campaign planning based on the event type and universities.
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
  const result = JSON.parse(extractJSON(raw))
  return { ...result, competitor_insights_source: 'simulated' }
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

  const daysUntilEvent = Math.max(
    1,
    Math.ceil((new Date(event.event_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
  )
  // Cap campaign duration at 14 days or the lead window, whichever is smaller.
  // Prevents the model from proposing 30-day campaigns for events 3 weeks away.
  const maxDurationDays = Math.min(daysUntilEvent, 14)

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
Days until event: ${daysUntilEvent}
Maximum campaign duration: ${maxDurationDays} days. This is days, not weeks. duration_days in your response must be a number between 1 and ${maxDurationDays}. Do not write "week" or "weeks" anywhere in the brief — use days only.

Performance context: ${JSON.stringify(perfData)}
Competitor opportunity: ${JSON.stringify(competitorData)}
Ambassador coverage: ${JSON.stringify(ambassadorData)}

Create the campaign brief.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const brief = JSON.parse(extractJSON(raw))
  // Clamp duration regardless of model output — prevents "14 weeks" style errors
  brief.duration_days = Math.min(Math.max(1, Number(brief.duration_days) || maxDurationDays), maxDurationDays)
  return brief
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
// Injects structured brand_visual context so designers / Canva AI cannot
// hallucinate palette, fonts, or layout. creative_override_allowed loosens
// palette constraints for celebratory event types only.
async function runDesignBriefAgent(
  anthropic: Anthropic,
  brief: CampaignBrief,
  event: CalendarEvent,
  brandVisual: any,
  markdownDesignSpec: string | null
): Promise<string> {

  const hasVisual = brandVisual && Object.keys(brandVisual).some(k => brandVisual[k])

  const brandVisualBlock = hasVisual
    ? `\nBRAND VISUAL IDENTITY
Primary color: ${brandVisual.primary_color || 'not set'}
Secondary color: ${brandVisual.secondary_color || 'not set'}
Accent color: ${brandVisual.accent_color || 'not set'}
Background: ${brandVisual.background_color || 'not set'}
Heading font: ${brandVisual.font_heading || 'not set'}
Body font: ${brandVisual.font_body || 'not set'}
Logo rules: ${brandVisual.logo_usage_rules || 'not specified'}
Visual style: ${brandVisual.visual_style || 'not specified'}
Photography: ${brandVisual.photography_style || 'not specified'}
Layout: ${brandVisual.layout_preference || 'not specified'}`
    : ''

  const platformDimensionsBlock = `\nPLATFORM DIMENSIONS (use exact dimensions for each deliverable)
- Facebook post: 1200×628 (landscape) or 1080×1080 (square)
- WhatsApp image: 800×800 or 1080×1920 (status)
- YouTube community: 1080×1080
- Email header: 600×200`

  const creativeBlock = event.creative_override_allowed
    ? '\nCREATIVE FREEDOM: Palette deviation permitted within the accent color family. All other brand rules apply.'
    : '\nCREATIVE FREEDOM: Full brand lock. No palette, typography, or style deviation permitted.'

  const designSpecBlock = markdownDesignSpec
    ? `\nBRAND SPEC (written by brand manager — apply exactly)\n${markdownDesignSpec}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    system: `Write a concise design brief for a student-focused EdTech campaign asset.
Plain text only. No markdown, no asterisks, no bold, no headers. Use plain bullet points with a dash (-). Under 200 words.
You MUST include the exact brand colors, font names, logo rules, and platform dimensions as specified. Do not substitute or invent values.`,
    messages: [{
      role: 'user',
      content: `Campaign: ${brief.name}
Key message: ${brief.key_message}
Platforms: ${brief.platforms.join(', ')}
Target: ${brief.target_audience} at ${event.universities.join(', ')}
${brandVisualBlock}
${platformDimensionsBlock}
${creativeBlock}
${designSpecBlock}

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

  // NOTE: This is a campaign readiness check, not a live performance check.
  // Posts have just been approved — they are scheduled but not yet published to
  // live platforms (M13). The monitor validates that the campaign setup is coherent
  // (KPI targets are set, brand voice is complete, event window is valid).
  // Real post-performance monitoring belongs in a scheduled check after M13 publishing.
  const weeklySignupBenchmark = kpiTargets?.weekly_signups ?? brief.expected_signups

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    system: `You are reviewing a campaign setup before it goes live. Posts have been approved but not yet published.
Check whether the campaign configuration is coherent and ready to execute.
Consider: are KPI targets set, is the campaign window realistic, does the goal match the event?
Do NOT claim to measure live post performance — posts are not published yet.
Respond with JSON: { "status": "ready|needs_attention", "insight": "...", "action": "none|escalate" }`,
    messages: [{
      role: 'user',
      content: `Campaign: ${brief.name}
Goal: ${brief.goal}
Duration: ${brief.duration_days} days
Expected signups: ${brief.expected_signups}
Weekly signup benchmark (KPI target): ${weeklySignupBenchmark}
Posts approved: ${(campaignPosts ?? []).length}
Platform metrics baseline: ${JSON.stringify(metrics?.slice(0, 4))}`
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

// ── next calendar event resolver ──────────────────────────────────────
// Used when pipeline-c is triggered without an explicit event context
// (e.g. standalone "run the campaign pipeline" command). Queries for the
// nearest upcoming event rather than falling back to a hardcoded demo.
async function getNextCalendarEvent(supabase: any, orgId: string, today: string): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('id, event_type, event_date, event_end_date, label, universities, lead_days, creative_override_allowed')
    .eq('org_id', orgId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(
      'No upcoming calendar event found. Add an event to the Academic Calendar before running a campaign.'
    )
  }

  return {
    id: data.id,
    event_type: data.event_type ?? 'other',
    event_date: data.event_date,
    event_end_date: data.event_end_date ?? null,
    label: data.label,
    universities: data.universities ?? [],
    lead_days: data.lead_days ?? 21,
  }
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

// Spread post scheduling evenly across the campaign window.
// Posts run from today through (eventDate - 1 day) so the last post fires
// the day before the event — not after it has already passed.
// With 6 posts and a 14-day window: posts on days 0, 2, 4, 7, 9, 11 approx.
function getScheduledTime(index: number, total: number, today: string, eventDate: string): string {
  const startMs = new Date(today).getTime()
  // End one day before the event so the last post is a pre-event reminder
  const endMs = new Date(eventDate).getTime() - 86400000
  const windowMs = Math.max(endMs - startMs, 0)

  // Evenly space posts across the window. If window is 0 (event is today),
  // all posts go out today — still better than stacking at index 0,1,2,3,4,5.
  const offsetMs = total > 1 ? Math.round((index / (total - 1)) * windowMs) : 0
  const scheduled = new Date(startMs + offsetMs)
  scheduled.setHours(9, 0, 0, 0)
  return scheduled.toISOString()
}
