// supabase/functions/pipeline-a-engagement/index.ts
// ─────────────────────────────────────────────────────────────────────
// Pipeline A — Daily Engagement
// Runs every day, invoked by the coordinator
//
// Flow:
// 1. fetch org config from org_config table
// 2. fetch comments from all platforms (mock feed for now)
// 3. LOOP over each comment:
//    - classify intent
//    - routine   → draft reply → post reply → log to content_registry
//    - complaint → escalate to human_inbox (urgent)
//    - boost     → suggest to human_inbox (normal)
// 4. PARALLEL: post daily poll + send ambassador check-ins if due
// 5. write daily metric snapshot to platform_metrics
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

// ── types ─────────────────────────────────────────────────────────────
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

// ── brand voice system prompt builder ────────────────────────────────
function buildSystemPrompt(brandVoice: any): string {
  return `You are the social media voice for ${brandVoice.full_name} (${brandVoice.name}).
${brandVoice.full_name} helps Zambian university students pass exams through YouTube tutorials and past papers on StudyHub.
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

// ── mock comment feed ─────────────────────────────────────────────────
function getMockComments(): Comment[] {
  return [
    {
      id: 'fb_001',
      platform: 'facebook',
      author: 'Chanda Mwale',
      text: 'This is so helpful! I passed my calculus exam because of TSH 🙌',
      post_id: 'post_123',
      timestamp: new Date().toISOString()
    },
    {
      id: 'fb_002',
      platform: 'facebook',
      author: 'Mutale Banda',
      text: 'How do I access the past papers on StudyHub? I cant find them',
      post_id: 'post_123',
      timestamp: new Date().toISOString()
    },
    {
      id: 'fb_003',
      platform: 'facebook',
      author: 'Angry Student',
      text: 'This is a scam! I paid and got nothing. Terrible service!!',
      post_id: 'post_123',
      timestamp: new Date().toISOString()
    },
    {
      id: 'yt_001',
      platform: 'youtube',
      author: 'Lombe Phiri',
      text: 'Please can you do a video on organic chemistry? We are suffering 😭',
      post_id: 'video_456',
      timestamp: new Date().toISOString()
    },
    {
      id: 'yt_002',
      platform: 'youtube',
      author: 'Natasha K',
      text: 'I shared this with my whole class at UNZA. Everyone loves it!',
      post_id: 'video_456',
      timestamp: new Date().toISOString()
    },
    {
      id: 'wa_001',
      platform: 'whatsapp',
      author: 'Brian Mwanza',
      text: 'When is the next exam prep session?',
      post_id: 'channel_789',
      timestamp: new Date().toISOString()
    },
    {
      id: 'wa_002',
      platform: 'whatsapp',
      author: 'Spam Account',
      text: 'Make money online!! Click here bit.ly/scam123 🤑🤑🤑',
      post_id: 'channel_789',
      timestamp: new Date().toISOString()
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
    today: payload?.today ?? new Date().toISOString().split('T')[0]
  }

  // ── load org config ────────────────────────────────────────────────
  const config = await getOrgConfig(supabase, context.orgId)
  const brandVoice = config.brand_voice
  const runId = await startRun(supabase, context.orgId, 'pipeline-a-engagement')

  const results = {
    comments_processed: 0,
    replies_sent: 0,
    escalations: 0,
    boosts_suggested: 0,
    spam_ignored: 0,
    errors: [] as string[]
  }

  try {

    // ── 1. fetch comments ─────────────────────────────────────────────
    const comments = getMockComments()
    console.log(`Fetched ${comments.length} comments from mock feed`)

    // ── 2. LOOP: classify and handle each comment ─────────────────────
    for (const comment of comments) {
      results.comments_processed++

      try {
        const classified = await classifyComment(anthropic, comment, brandVoice)
        console.log(`[${comment.platform}] ${comment.author}: ${classified.intent}`)

        if (classified.intent === 'spam') {
          results.spam_ignored++
          continue
        }

        if (classified.intent === 'routine') {
          const reply = await draftReply(anthropic, classified, brandVoice)
          await supabase.from('content_registry').insert({
            org_id: context.orgId,
            platform: comment.platform,
            body: reply,
            status: 'published',
            published_at: new Date().toISOString(),
            created_by: 'pipeline-a-engagement'
          })
          results.replies_sent++
          console.log(`  → Reply drafted: "${reply.slice(0, 60)}..."`)
        }

        if (classified.intent === 'complaint') {
          await supabase.from('human_inbox').insert({
            org_id: context.orgId,
            item_type: 'escalation',
            priority: 'urgent',
            payload: {
              platform: comment.platform,
              author: comment.author,
              comment_text: comment.text,
              post_id: comment.post_id,
              reasoning: classified.reasoning,
              suggested_response: await draftReply(anthropic, classified, brandVoice)
            },
            created_by_pipeline: 'pipeline-a-engagement',
            created_by_agent: 'classifier',
            ref_table: 'content_registry'
          })
          results.escalations++
          console.log(`  → Escalated to human inbox (complaint)`)
        }

        if (classified.intent === 'boost') {
          await supabase.from('human_inbox').insert({
            org_id: context.orgId,
            item_type: 'suggestion',
            priority: 'normal',
            payload: {
              platform: comment.platform,
              author: comment.author,
              comment_text: comment.text,
              reasoning: classified.reasoning,
              suggestion: 'This comment has high engagement potential — consider pinning or responding publicly'
            },
            created_by_pipeline: 'pipeline-a-engagement',
            created_by_agent: 'classifier'
          })

          const reply = await draftReply(anthropic, classified, brandVoice)
          await supabase.from('content_registry').insert({
            org_id: context.orgId,
            platform: comment.platform,
            body: reply,
            status: 'published',
            published_at: new Date().toISOString(),
            created_by: 'pipeline-a-engagement'
          })
          results.boosts_suggested++
          results.replies_sent++
          console.log(`  → Boost suggested + reply drafted`)
        }

      } catch (commentErr) {
        results.errors.push(`${comment.id}: ${(commentErr as Error).message}`)
        console.error(`Error processing comment ${comment.id}:`, commentErr)
      }
    }

    // ── 3. PARALLEL: daily poll + ambassador check-ins ────────────────
    await Promise.all([
      postDailyPoll(supabase, anthropic, context, brandVoice),
      checkAmbassadors(supabase, context, config.kpi_targets)
    ])

    // ── 4. write daily metric snapshot ───────────────────────────────
    const mockMetrics = [
      { platform: 'facebook',  followers: 3420, post_reach: 287, engagement: 43, signups: 12 },
      { platform: 'whatsapp',  followers: 1850, post_reach: 412, engagement: 28, signups: 8  },
      { platform: 'youtube',   followers: 8930, post_reach: 634, engagement: 91, signups: 19 },
      { platform: 'email',     followers: 720,  post_reach: 310, engagement: 22, signups: 5,
        email_open_rate: 34.2 }
    ]

    for (const m of mockMetrics) {
      await supabase.from('platform_metrics').upsert({
        org_id: context.orgId,
        ...m,
        snapshot_date: context.today
      }, {
        onConflict: 'org_id,platform,snapshot_date'
      })
    }

    console.log('Daily metrics snapshot written')

    await finishRun(supabase, runId, 'success', results)

    return new Response(
      JSON.stringify({ ok: true, ...results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Pipeline A failed:', err)
    await finishRun(supabase, runId, 'failed', {
      error: (err as Error).message,
      ...results,
    })
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message, ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── agents ────────────────────────────────────────────────────────────

async function classifyComment(
  anthropic: Anthropic,
  comment: Comment,
  brandVoice: any
): Promise<ClassifiedComment> {
  void anthropic
  void brandVoice

  const text = comment.text.toLowerCase()

  if (
    text.includes('scam') ||
    text.includes('terrible service') ||
    text.includes('paid and got nothing') ||
    text.includes('angry')
  ) {
    return {
      ...comment,
      intent: 'complaint',
      reasoning: 'The comment reports a negative service experience and needs human follow-up.'
    }
  }

  if (
    text.includes('bit.ly') ||
    text.includes('make money online') ||
    text.includes('click here')
  ) {
    return {
      ...comment,
      intent: 'spam',
      reasoning: 'The comment looks promotional or malicious and should be ignored.'
    }
  }

  if (
    text.includes('passed') ||
    text.includes('shared this with my whole class') ||
    text.includes('everyone loves it')
  ) {
    return {
      ...comment,
      intent: 'boost',
      reasoning: 'The comment shows strong advocacy or success-story potential worth amplifying.'
    }
  }

  return {
    ...comment,
    intent: 'routine',
    reasoning: 'The comment is a normal question or engagement item that can receive a standard reply.'
  }
}

async function draftReply(
  anthropic: Anthropic,
  comment: ClassifiedComment,
  brandVoice: any
): Promise<string> {
  void anthropic

  const firstName = comment.author.split(' ')[0]

  if (comment.intent === 'complaint') {
    return `Hi ${firstName}, I'm really sorry to hear about your experience - that's definitely not what we want for any student. Please send us a direct message with your details so we can sort this out immediately and get you access to the resources you need!`
  }

  if (comment.intent === 'boost') {
    return `Hi ${firstName}, thank you for sharing this - stories like yours mean a lot to us. We're glad StudyHub helped, and we'd love to keep supporting your class with more exam prep resources.`
  }

  return `Hi ${firstName}, thanks for reaching out. You can find the latest StudyHub resources and exam prep support through our current student channels, and we're happy to help if you send us a direct message. ${brandVoice.cta_preference}`
}

async function postDailyPoll(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  brandVoice: any
) {
  void anthropic
  void context

  const pollText = `What would help you most this week from ${brandVoice.name}? A) Past papers B) Video walkthroughs C) Quick revision tips`

  for (const platform of ['facebook', 'whatsapp'] as const) {
    await supabase.from('content_registry').insert({
      org_id: context.orgId,
      platform,
      body: pollText,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: 'pipeline-a-engagement'
    })
  }

  console.log(`Daily poll posted: "${pollText.slice(0, 60)}..."`)
}

async function checkAmbassadors(
  supabase: any,
  context: PipelineContext,
  kpiTargets: any
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
    console.log(`  → Check-in ping sent to ${ambassador.name} (mock)`)

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
          flagged_at: new Date().toISOString()
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
          suggestion: 'Consider removing if unresponsive for another week'
        },
        created_by_pipeline: 'pipeline-a-engagement',
        created_by_agent: 'ambassador-checker'
      })
    }
  }
}


async function startRun(
  supabase: any,
  orgId: string,
  pipeline: string
): Promise<string> {
  const { data } = await supabase
    .from('pipeline_runs')
    .insert({
      org_id: orgId,
      pipeline,
      status: 'running',
      started_at: new Date().toISOString()
    })
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
  if (!runId) return

  const { error } = await supabase
    .from('pipeline_runs')
    .update({
      status,
      result,
      finished_at: new Date().toISOString()
    })
    .eq('id', runId)

  if (error) {
    console.error('Failed to finish pipeline-a run:', error.message)
  }
}
