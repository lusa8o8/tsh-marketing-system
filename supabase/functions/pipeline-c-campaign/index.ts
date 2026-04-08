// supabase/functions/pipeline-c-campaign/index.ts
// ─────────────────────────────────────────────────────────────────────
// Pipeline C — Campaign & Monthly Engine
// Triggered by coordinator when a calendar event hits its lead window
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

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

  const context: PipelineContext = await req.json().catch(() => ({
    orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    today: new Date().toISOString().split('T')[0],
    calendarEvent: {
      id: 'demo-event',
      event_type: 'exam_window',
      event_date: '2026-05-11',
      event_end_date: '2026-05-29',
      label: 'UNZA semester 1 exams 2026',
      universities: ['UNZA'],
      lead_days: 21
    }
  }))

  const config = await getOrgConfig(supabase, context.orgId)

  const results = {
    research_completed: false,
    campaign_brief_sent: false,
    campaign_name: '',
    copy_assets_created: 0,
    design_brief_sent: false,
    posts_scheduled: 0,
    monitor_check_run: false,
    report_generated: false,
    errors: [] as string[]
  }

  try {
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
          }
        },
        created_by_pipeline: 'pipeline-c-campaign',
        created_by_agent: 'campaign-planner',
        expires_at: addDays(context.today, 3)
      })
      .select('id')
      .single()

    results.campaign_brief_sent = true
    console.log(`Campaign brief sent to CEO inbox: "${campaignBrief.name}"`)
    console.log('DEMO MODE: auto-approving campaign brief...')

    if (inboxRow?.id) {
      await supabase
        .from('human_inbox')
        .update({
          status: 'approved',
          actioned_by: 'demo-auto-approve',
          actioned_at: new Date().toISOString(),
          action_note: 'Auto-approved for demo purposes'
        })
        .eq('id', inboxRow.id)
    }

    // ── PARALLEL ASSET CREATION ───────────────────────────────────────
    console.log('Starting parallel asset creation...')

    const [copyAssets, designBrief] = await Promise.all([
      runCopyWriter(anthropic, campaignBrief, event, config.brand_voice),
      runDesignBriefAgent(anthropic, campaignBrief, event)
    ])

    results.copy_assets_created = copyAssets.length

    for (const asset of copyAssets) {
      const { data: regRow } = await supabase
        .from('content_registry')
        .insert({
          org_id: context.orgId,
          platform: asset.platform,
          body: asset.body,
          subject_line: asset.subject_line ?? null,
          status: 'pending_approval',
          is_campaign_post: true,
          scheduled_at: getScheduledTime(asset.day_offset, context.today),
          created_by: 'pipeline-c-campaign'
        })
        .select('id')
        .single()

      await supabase.from('human_inbox').insert({
        org_id: context.orgId,
        item_type: 'draft_approval',
        priority: 'normal',
        payload: {
          campaign_name: campaignBrief.name,
          platform: asset.platform,
          body: asset.body,
          subject_line: asset.subject_line,
          day_offset: asset.day_offset,
          content_registry_id: regRow?.id
        },
        created_by_pipeline: 'pipeline-c-campaign',
        created_by_agent: 'copy-writer',
        ref_table: 'content_registry',
        ref_id: regRow?.id
      })
    }

    await supabase.from('human_inbox').insert({
      org_id: context.orgId,
      item_type: 'suggestion',
      priority: 'normal',
      payload: {
        type: 'design_brief',
        campaign_name: campaignBrief.name,
        brief: designBrief
      },
      created_by_pipeline: 'pipeline-c-campaign',
      created_by_agent: 'design-brief-agent'
    })

    results.design_brief_sent = true
    console.log(`${copyAssets.length} copy assets sent for approval`)
    console.log('Design brief sent to human inbox')

    // ── DEMO: auto-approve and schedule ──────────────────────────────
    console.log('DEMO MODE: auto-approving copy assets...')

    const { data: pendingPosts } = await supabase
      .from('content_registry')
      .select('*')
      .eq('org_id', context.orgId)
      .eq('status', 'pending_approval')
      .eq('is_campaign_post', true)

    for (const post of (pendingPosts ?? [])) {
      await supabase
        .from('content_registry')
        .update({ status: 'scheduled' })
        .eq('id', post.id)
      results.posts_scheduled++
    }

    console.log(`${results.posts_scheduled} campaign posts scheduled`)

    // ── MONITOR ───────────────────────────────────────────────────────
    console.log('Running campaign monitor check...')
    await runMonitor(supabase, anthropic, context, campaignBrief, config.kpi_targets)
    results.monitor_check_run = true

    // ── POST-CAMPAIGN REPORT ──────────────────────────────────────────
    console.log('Generating post-campaign report...')
    await runPostCampaignReport(supabase, anthropic, context, campaignBrief, results)
    results.report_generated = true

    return new Response(
      JSON.stringify({ ok: true, ...results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Pipeline C failed:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err.message, ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── performance analyser ──────────────────────────────────────────────
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

// ── copy writer ───────────────────────────────────────────────────────
async function runCopyWriter(
  anthropic: Anthropic,
  brief: CampaignBrief,
  event: CalendarEvent,
  brandVoice: any
): Promise<any[]> {

  const platforms = [
    { platform: 'facebook', instruction: '2-3 sentences, engaging hook, emoji ok, end with StudyHub link' },
    { platform: 'facebook', instruction: 'different angle from first post, focus on social proof or urgency' },
    { platform: 'whatsapp', instruction: 'under 200 characters, conversational, one clear call to action' },
    { platform: 'youtube', instruction: 'short community post, ask a question to drive comments' },
    { platform: 'email', instruction: 'start first line with Subject: then write email body, warm and helpful' },
    { platform: 'whatsapp', instruction: 'ambassador talking points — bullet list of what to say to classmates' },
  ]

  const assets: any[] = []

  for (const p of platforms) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        system: `${buildSystemPrompt(brandVoice)}

Write ONLY the post copy — no JSON, no quotes around it, no preamble.`,
        messages: [{
          role: 'user',
          content: `Campaign: ${brief.name}
Key message: ${brief.key_message}
Call to action: ${brief.call_to_action}
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

      assets.push({
        platform: p.platform,
        day_offset: assets.length,
        body: postBody,
        subject_line,
        type: 'campaign'
      })

    } catch (err) {
      console.error(`Copy writer failed for ${p.platform}:`, err.message)
    }
  }

  return assets
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
      created_by_agent: 'monitor'
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
    created_by_agent: 'post-campaign-reporter'
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
