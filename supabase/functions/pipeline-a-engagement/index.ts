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

  const context: PipelineContext = await req.json().catch(() => ({
    orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    today: new Date().toISOString().split('T')[0]
  }))

  // ── load org config ────────────────────────────────────────────────
  const config = await getOrgConfig(supabase, context.orgId)
  const brandVoice = config.brand_voice

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

    return new Response(
      JSON.stringify({ ok: true, ...results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Pipeline A failed:', err)
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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: `You are a comment classifier for ${brandVoice.full_name} (${brandVoice.name}).
${brandVoice.name} is an EdTech platform helping Zambian university students pass exams.

Classify each comment into exactly one of these intents:
- routine: questions, praise, general engagement — reply warmly
- complaint: anger, accusations, bad experience — escalate to human
- boost: highly shareable, viral potential, student success story — flag + reply
- spam: promotional links, irrelevant, bots — ignore

Respond with JSON only, no markdown, no code fences:
{ "intent": "routine|complaint|boost|spam", "reasoning": "one sentence" }`,
    messages: [{
      role: 'user',
      content: `Platform: ${comment.platform}
Author: ${comment.author}
Comment: "${comment.text}"`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const parsed = JSON.parse(extractJSON(raw))

  return {
    ...comment,
    intent: parsed.intent as Intent,
    reasoning: parsed.reasoning
  }
}

async function draftReply(
  anthropic: Anthropic,
  comment: ClassifiedComment,
  brandVoice: any
): Promise<string> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `${buildSystemPrompt(brandVoice)}

Keep replies under 3 sentences. Use the student's name if available.
Write the reply only — no preamble, no quotes around it.`,
    messages: [{
      role: 'user',
      content: `Write a reply to this ${comment.platform} comment.
Author: ${comment.author}
Comment: "${comment.text}"
Intent: ${comment.intent}`
    }]
  })

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : `Thank you for your comment! Check out StudyHub for more resources. ${brandVoice.cta_preference}`
}

async function postDailyPoll(
  supabase: any,
  anthropic: Anthropic,
  context: PipelineContext,
  brandVoice: any
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    system: `You write short engagement poll questions for ${brandVoice.name}'s Facebook and WhatsApp.
${brandVoice.name} helps Zambian university students pass exams.
Keep it relevant to student life. One question, 2-3 options max.
Format: just the question text, no JSON, no preamble.`,
    messages: [{
      role: 'user',
      content: `Write one poll question for today (${context.today}) to post on Facebook and WhatsApp.`
    }]
  })

  const pollText = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Which subject do you find hardest? 📚 A) Maths  B) Chemistry  C) English'

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
