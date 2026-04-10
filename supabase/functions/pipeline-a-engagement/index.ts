import { getAgentDefinition } from '../_shared/agent-registry.ts'
import { getIntegrationDefinition } from '../_shared/integration-registry.ts'
import {
  executePipelineSteps,
  runPipelineExecution,
  type PipelineExecutableStep,
} from '../_shared/pipeline-engine.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

interface Comment {
  id: string
  platform: 'facebook' | 'whatsapp' | 'youtube'
  author: string
  text: string
  post_id: string
  timestamp: string
}

type Intent = 'routine' | 'complaint' | 'boost' | 'spam'

interface ClassifiedComment extends Comment {
  intent: Intent
  reasoning: string
}

interface PipelineContext {
  orgId: string
  today: string
}

interface PipelineAState {
  comments_processed: number
  replies_sent: number
  escalations: number
  boosts_suggested: number
  spam_ignored: number
  errors: string[]
}

interface PipelineAEngineContext {
  supabase: any
  anthropic: Anthropic
  context: PipelineContext
  config: any
  brandVoice: any
  comments: Comment[]
}

async function getOrgConfig(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('org_config')
    .select('*')
    .eq('org_id', orgId)
    .single()
  if (error) throw new Error(`Failed to load org config: ${error.message}`)
  return data
}

function getMockComments(): Comment[] {
  return [
    {
      id: 'fb_001',
      platform: getIntegrationDefinition('facebook').id,
      author: 'Chanda Mwale',
      text: 'This is so helpful! I passed my calculus exam because of TSH 🙌',
      post_id: 'post_123',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'fb_002',
      platform: getIntegrationDefinition('facebook').id,
      author: 'Mutale Banda',
      text: 'How do I access the past papers on StudyHub? I cant find them',
      post_id: 'post_123',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'fb_003',
      platform: getIntegrationDefinition('facebook').id,
      author: 'Angry Student',
      text: 'This is a scam! I paid and got nothing. Terrible service!!',
      post_id: 'post_123',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'yt_001',
      platform: getIntegrationDefinition('youtube').id,
      author: 'Lombe Phiri',
      text: 'Please can you do a video on organic chemistry? We are suffering 😭',
      post_id: 'video_456',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'yt_002',
      platform: getIntegrationDefinition('youtube').id,
      author: 'Natasha K',
      text: 'I shared this with my whole class at UNZA. Everyone loves it!',
      post_id: 'video_456',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'wa_001',
      platform: getIntegrationDefinition('whatsapp').id,
      author: 'Brian Mwanza',
      text: 'When is the next exam prep session?',
      post_id: 'channel_789',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'wa_002',
      platform: getIntegrationDefinition('whatsapp').id,
      author: 'Spam Account',
      text: 'Make money online!! Click here bit.ly/scam123 🤑🤑🤑',
      post_id: 'channel_789',
      timestamp: new Date().toISOString(),
    },
  ]
}

function createInitialResults(): PipelineAState {
  return {
    comments_processed: 0,
    replies_sent: 0,
    escalations: 0,
    boosts_suggested: 0,
    spam_ignored: 0,
    errors: [],
  }
}

function createPipelineASteps(): PipelineExecutableStep<PipelineAState, PipelineAEngineContext>[] {
  return [
    {
      kind: 'task',
      id: 'fetch-comments',
      run: async ({ context }) => {
        context.comments = getMockComments()
        console.log(`Fetched ${context.comments.length} comments from mock feed`)
      },
    },
    {
      kind: 'for_each',
      id: 'process-comments',
      getItems: ({ context }) => context.comments,
      runItem: async ({ state, context, item }) => {
        await processComment(item as Comment, state, context)
      },
    },
    {
      kind: 'parallel',
      id: 'engagement-followups',
      steps: [
        {
          kind: 'task',
          id: 'post-daily-poll',
          run: async ({ context }) => {
            await postDailyPoll(context.supabase, context.anthropic, context.context, context.brandVoice)
          },
        },
        {
          kind: 'task',
          id: 'check-ambassadors',
          run: async ({ context }) => {
            await checkAmbassadors(context.supabase, context.context, context.config.kpi_targets)
          },
        },
      ],
    },
    {
      kind: 'task',
      id: 'write-metric-snapshot',
      run: async ({ context }) => {
        await writeMetricSnapshot(context.supabase, context.context)
      },
    },
  ]
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const anthropic = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
  })

  const payload = await req.json().catch(() => ({}))
  const context: PipelineContext = {
    orgId: payload?.orgId ?? payload?.org_id ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    today: payload?.today ?? new Date().toISOString().split('T')[0],
  }

  const config = await getOrgConfig(supabase, context.orgId)
  const brandVoice = config.brand_voice
  const state = createInitialResults()
  const engineContext: PipelineAEngineContext = {
    supabase,
    anthropic,
    context,
    config,
    brandVoice,
    comments: [],
  }

  const execution = await runPipelineExecution({
    supabase,
    orgId: context.orgId,
    pipeline: 'pipeline-a-engagement',
    state,
    execute: async (results) => {
      await executePipelineSteps(createPipelineASteps(), {
        state: results,
        context: engineContext,
      })
    },
  })

  if (!execution.ok) {
    console.error('Pipeline A failed:', execution.error)
    return new Response(
      JSON.stringify({ ok: false, error: execution.error.message, ...execution.state }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ ok: true, ...execution.state }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

async function processComment(
  comment: Comment,
  results: PipelineAState,
  engineContext: PipelineAEngineContext,
) {
  results.comments_processed += 1

  try {
    const classified = await classifyComment(engineContext.anthropic, comment, engineContext.brandVoice)
    console.log(`[${comment.platform}] ${comment.author}: ${classified.intent}`)

    if (classified.intent === 'spam') {
      results.spam_ignored += 1
      return
    }

    if (classified.intent === 'routine') {
      const reply = await draftReply(engineContext.anthropic, classified, engineContext.brandVoice)
      await engineContext.supabase.from('content_registry').insert({
        org_id: engineContext.context.orgId,
        platform: comment.platform,
        body: reply,
        status: 'published',
        published_at: new Date().toISOString(),
        created_by: 'pipeline-a-engagement',
      })
      results.replies_sent += 1
      console.log(`  -> Reply drafted: "${reply.slice(0, 60)}..."`)
    }

    if (classified.intent === 'complaint') {
      await engineContext.supabase.from('human_inbox').insert({
        org_id: engineContext.context.orgId,
        item_type: 'escalation',
        priority: 'urgent',
        payload: {
          platform: comment.platform,
          author: comment.author,
          comment_text: comment.text,
          post_id: comment.post_id,
          reasoning: classified.reasoning,
          suggested_response: await draftReply(engineContext.anthropic, classified, engineContext.brandVoice),
        },
        created_by_pipeline: 'pipeline-a-engagement',
        created_by_agent: getAgentDefinition('classifier').id,
        ref_table: 'content_registry',
      })
      results.escalations += 1
      console.log('  -> Escalated to human inbox (complaint)')
    }

    if (classified.intent === 'boost') {
      await engineContext.supabase.from('human_inbox').insert({
        org_id: engineContext.context.orgId,
        item_type: 'suggestion',
        priority: 'fyi',
        payload: {
          platform: comment.platform,
          author: comment.author,
          comment_text: comment.text,
          reasoning: classified.reasoning,
          suggestion: 'This comment has high engagement potential — consider pinning or responding publicly',
        },
        created_by_pipeline: 'pipeline-a-engagement',
        created_by_agent: getAgentDefinition('classifier').id,
      })

      const reply = await draftReply(engineContext.anthropic, classified, engineContext.brandVoice)
      await engineContext.supabase.from('content_registry').insert({
        org_id: engineContext.context.orgId,
        platform: comment.platform,
        body: reply,
        status: 'published',
        published_at: new Date().toISOString(),
        created_by: 'pipeline-a-engagement',
      })
      results.boosts_suggested += 1
      results.replies_sent += 1
      console.log('  -> Boost suggested + reply drafted')
    }
  } catch (commentErr) {
    results.errors.push(`${comment.id}: ${(commentErr as Error).message}`)
    console.error(`Error processing comment ${comment.id}:`, commentErr)
  }
}

async function classifyComment(
  anthropic: Anthropic,
  comment: Comment,
  brandVoice: any,
): Promise<ClassifiedComment> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: `You are a comment classifier for a social media engagement system.

Classify the comment into exactly one intent:
- spam: promotional content, suspicious links, fake accounts, unsolicited advertising
- complaint: negative service experience, payment issues, strong accusations of wrongdoing
- boost: strong advocacy, success stories, viral-sharing potential, testimonials
- routine: questions, general engagement, requests for information, neutral feedback

Context about the organisation:
- Tone: ${brandVoice.tone ?? 'professional'}
- Audience: ${brandVoice.target_audience ?? 'students'}

Respond with valid JSON only — no explanation, no markdown:
{"intent":"spam|complaint|boost|routine","reasoning":"one sentence"}`,
    messages: [
      {
        role: 'user',
        content: `Platform: ${comment.platform}\nAuthor: ${comment.author}\nComment: ${comment.text}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  try {
    const parsed = JSON.parse(raw) as { intent: Intent; reasoning: string }
    return { ...comment, intent: parsed.intent, reasoning: parsed.reasoning }
  } catch {
    // Fallback: treat as routine if JSON parse fails
    console.warn('classifyComment JSON parse failed, defaulting to routine. Raw:', raw)
    return { ...comment, intent: 'routine', reasoning: 'Classification parse error — treated as routine.' }
  }
}

async function draftReply(
  anthropic: Anthropic,
  comment: ClassifiedComment,
  brandVoice: any,
): Promise<string> {
  const firstName = comment.author.split(' ')[0]

  const intentGuidance: Record<Intent, string> = {
    complaint: 'Acknowledge their frustration with genuine empathy. Invite them to DM for a resolution. Do not be defensive.',
    boost: 'Express sincere appreciation for their advocacy. Reinforce the brand mission. Encourage sharing.',
    routine: `Answer helpfully and warmly. End with the preferred CTA: "${brandVoice.preferred_cta ?? 'Learn more'}".`,
    spam: '',
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: `You are a community manager replying to social media comments on behalf of this organisation.

Brand voice:
- Tone: ${brandVoice.tone ?? 'warm, professional'}
- Audience: ${brandVoice.target_audience ?? 'university students'}
- Always say: ${(brandVoice.always_say ?? []).join(', ') || 'nothing specific'}
- Never say: ${(brandVoice.never_say ?? []).join(', ') || 'nothing specific'}
${brandVoice.good_post_example ? `\nGood example post: "${brandVoice.good_post_example}"` : ''}

Rules:
- Address the person by first name (${firstName})
- Maximum 2 sentences
- No hashtags
- Plain conversational text only`,
    messages: [
      {
        role: 'user',
        content: `Comment intent: ${comment.intent}
Guidance: ${intentGuidance[comment.intent]}

Platform: ${comment.platform}
Comment: "${comment.text}"

Write the reply:`,
      },
    ],
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text.trim() : `Hi ${firstName}, thanks for reaching out — please DM us for more details.`
  return reply
}

async function postDailyPoll(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  brandVoice: any,
) {
  void anthropic
  void context

  const pollText = `What would help you most this week from ${brandVoice.name}? A) Past papers B) Video walkthroughs C) Quick revision tips`

  for (const platform of [getIntegrationDefinition('facebook').id, getIntegrationDefinition('whatsapp').id] as const) {
    await supabase.from('content_registry').insert({
      org_id: context.orgId,
      platform,
      body: pollText,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: 'pipeline-a-engagement',
    })
  }

  console.log(`Daily poll posted: "${pollText.slice(0, 60)}..."`)
}

async function checkAmbassadors(
  supabase: any,
  context: PipelineContext,
  kpiTargets: any,
) {
  const checkinDays = kpiTargets.comment_response_hours
    ? Math.ceil(kpiTargets.comment_response_hours / 24) * 7
    : 7

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - checkinDays)

  const { data: overdueAmbassadors } = await supabase
    .from('ambassador_registry')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('status', 'active')
    .or(`last_checkin.is.null,last_checkin.lte.${cutoffDate.toISOString()}`)

  if (!overdueAmbassadors || overdueAmbassadors.length === 0) {
    console.log('All ambassadors up to date')
    return
  }

  console.log(`${overdueAmbassadors.length} ambassadors due for check-in`)

  for (const ambassador of overdueAmbassadors) {
    console.log(`  -> Check-in ping sent to ${ambassador.name} (mock)`)

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const lastCheckin = ambassador.last_checkin
      ? new Date(ambassador.last_checkin)
      : null

    if (!lastCheckin || lastCheckin < fourteenDaysAgo) {
      await supabase
        .from('ambassador_registry')
        .update({
          status: 'flagged',
          flagged_reason: 'No check-in for 14+ days',
          flagged_at: new Date().toISOString(),
        })
        .eq('id', ambassador.id)

      await supabase.from('human_inbox').insert({
        org_id: context.orgId,
        item_type: 'ambassador_flag',
        priority: 'normal',
        payload: {
          ambassador_id: ambassador.id,
          name: ambassador.name,
          university: ambassador.university,
          reason: 'No check-in for 14+ days',
          last_checkin: ambassador.last_checkin,
          suggestion: 'Consider removing if unresponsive for another week',
        },
        created_by_pipeline: 'pipeline-a-engagement',
        created_by_agent: getAgentDefinition('ambassador_checker').id,
      })
    }
  }
}

async function writeMetricSnapshot(
  supabase: any,
  context: PipelineContext,
) {
  const mockMetrics = [
    { platform: getIntegrationDefinition('facebook').id, followers: 3420, post_reach: 287, engagement: 43, signups: 12 },
    { platform: getIntegrationDefinition('whatsapp').id, followers: 1850, post_reach: 412, engagement: 28, signups: 8 },
    { platform: getIntegrationDefinition('youtube').id, followers: 8930, post_reach: 634, engagement: 91, signups: 19 },
    { platform: getIntegrationDefinition('email').id, followers: 720, post_reach: 310, engagement: 22, signups: 5, email_open_rate: 34.2 },
  ]

  for (const metric of mockMetrics) {
    await supabase.from('platform_metrics').upsert({
      org_id: context.orgId,
      ...metric,
      snapshot_date: context.today,
    }, {
      onConflict: 'org_id,platform,snapshot_date',
    })
  }

  console.log('Daily metrics snapshot written')
}