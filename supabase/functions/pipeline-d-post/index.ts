// supabase/functions/pipeline-d-post/index.ts
// ─────────────────────────────────────────────────────────────────────
// Pipeline D — One-Off Post
// Lightweight utility for ad-hoc "write a post about X" requests.
// No research, no brief, no CEO gate, no monitor, no pipeline_runs row.
// Flow: topic → canonical copy → parallel platform adapters → Content Registry drafts
// Designed to complete in < 10 seconds.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { getIntegrationDefinition } from '../_shared/integration-registry.ts'

const DEFAULT_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const DEFAULT_PLATFORMS = ['facebook', 'whatsapp', 'youtube', 'email']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractJSON(text: string, fallback = '{}') {
  try {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) return text.slice(firstBrace, lastBrace + 1)
  } catch (_e) { /* fall through */ }
  return fallback
}

// ── org config ────────────────────────────────────────────────────────
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

  return `You are the social media voice for ${brandVoice.full_name ?? brandVoice.name ?? 'this organisation'}.
Target audience: ${brandVoice.target_audience ?? ''}
Tone: ${brandVoice.tone ?? ''}
Always: ${(brandVoice.always_say ?? []).join(', ')}
Never: ${(brandVoice.never_say ?? []).join(', ')}
Preferred CTA: ${brandVoice.cta_preference ?? brandVoice.preferred_cta ?? ''}
Good post example: "${brandVoice.example_good_post ?? brandVoice.good_post_example ?? ''}"
Bad post example: "${brandVoice.example_bad_post ?? brandVoice.bad_post_example ?? ''}"${hashtagLine}${formatLine}`
}

// ── Phase 1: canonical copy ───────────────────────────────────────────
// One LLM call produces the headline, body, CTA, and key fact that
// all platform adapters must use verbatim — no drift between platforms.
async function runCanonicalCopy(
  anthropic: Anthropic,
  topic: string,
  eventRef: string | null,
  brandVoice: any
): Promise<{ headline: string; core_body: string; exact_cta: string; key_fact: string }> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `${buildSystemPrompt(brandVoice)}

Distil the single most important message for this topic into its purest form.
Respond with JSON only:
{
  "headline": "hook line to use verbatim across all platforms",
  "core_body": "1-2 sentences that explain the point and why it matters",
  "exact_cta": "the exact call-to-action text to use verbatim on every platform",
  "key_fact": "the single most important detail to include everywhere"
}`,
    messages: [{
      role: 'user',
      content: `Topic: ${topic}${eventRef ? `\nRelated event: ${eventRef}` : ''}

Write the canonical message now.`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(extractJSON(raw))
}

// ── Phase 2: platform adapters (parallel) ────────────────────────────
// Each adapter adapts the canonical message for its platform only.
// headline, exact_cta, and key_fact must appear verbatim in every asset.
async function runPlatformAdapters(
  anthropic: Anthropic,
  topic: string,
  canonical: { headline: string; core_body: string; exact_cta: string; key_fact: string },
  platforms: string[],
  brandVoice: any
): Promise<Array<{ platform: string; body: string; subject_line?: string }>> {

  const PLATFORM_INSTRUCTIONS: Record<string, string> = {
    [getIntegrationDefinition('facebook').id]: '2-3 sentences, emoji ok, end with the CTA and StudyHub link',
    [getIntegrationDefinition('whatsapp').id]: 'under 200 characters, conversational, one clear call to action',
    [getIntegrationDefinition('youtube').id]: 'short community post, ask a question to drive comments',
    [getIntegrationDefinition('email').id]: 'start first line with Subject: then write email body, warm and helpful',
  }

  const requests = platforms
    .filter(p => PLATFORM_INSTRUCTIONS[p])
    .map(async (platform) => {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: `${buildSystemPrompt(brandVoice)}

Write ONLY the post copy — no JSON, no quotes, no preamble.

You MUST include these elements verbatim:
- Opening headline: "${canonical.headline}"
- Call to action: "${canonical.exact_cta}"
- Key fact: "${canonical.key_fact}"

Adapt format, length, and tone for the platform only.`,
          messages: [{
            role: 'user',
            content: `Topic: ${topic}
Core message: ${canonical.core_body}
Platform: ${platform}
Instructions: ${PLATFORM_INSTRUCTIONS[platform]}

Write the copy now.`
          }]
        })

        const body = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : ''

        let subject_line: string | undefined
        let postBody = body

        if (platform === 'email' && body.startsWith('Subject:')) {
          const lines = body.split('\n')
          subject_line = lines[0].replace('Subject:', '').trim()
          postBody = lines.slice(1).join('\n').trim()
        }

        return { platform, body: postBody, subject_line }
      } catch (err) {
        console.error(`Pipeline D adapter failed for ${platform}:`, err instanceof Error ? err.message : String(err))
        return null
      }
    })

  const results = await Promise.all(requests)
  return results.filter((r): r is NonNullable<typeof r> => r !== null)
}

// ── main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const payload = await req.json().catch(() => ({}))
    const orgId: string = payload?.org_id ?? payload?.orgId ?? DEFAULT_ORG_ID
    const topic: string = String(payload?.topic ?? '').trim()
    const platforms: string[] = Array.isArray(payload?.platforms) && payload.platforms.length > 0
      ? payload.platforms
      : DEFAULT_PLATFORMS
    const eventRef: string | null = payload?.event_ref ? String(payload.event_ref) : null

    if (!topic) {
      return jsonResponse({ ok: false, error: 'topic is required' }, 400)
    }

    const config = await getOrgConfig(supabase, orgId)
    const brandVoice = config?.brand_voice ?? {}

    console.log(`Pipeline D: writing post about "${topic}" for platforms: ${platforms.join(', ')}`)

    // Phase 1: canonical copy (1 LLM call)
    const canonical = await runCanonicalCopy(anthropic, topic, eventRef, brandVoice)
    console.log(`Canonical headline locked: "${canonical.headline}"`)

    // Phase 2: platform adapters (parallel LLM calls)
    const assets = await runPlatformAdapters(anthropic, topic, canonical, platforms, brandVoice)
    console.log(`${assets.length} platform drafts produced`)

    // Phase 3: insert drafts into Content Registry
    let inserted = 0
    for (const asset of assets) {
      const { error } = await supabase
        .from('content_registry')
        .insert({
          org_id: orgId,
          platform: asset.platform,
          body: asset.body,
          subject_line: asset.subject_line ?? null,
          status: 'draft',
          is_campaign_post: false,
          created_by: 'pipeline-d-post',
        })
      if (!error) {
        inserted++
      } else {
        console.error(`Failed to insert draft for ${asset.platform}:`, error.message)
      }
    }

    console.log(`Pipeline D complete: ${inserted} drafts in Content Registry`)

    return jsonResponse({ ok: true, drafts_created: inserted, platforms_written: assets.map(a => a.platform) })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Pipeline D failed:', err)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
