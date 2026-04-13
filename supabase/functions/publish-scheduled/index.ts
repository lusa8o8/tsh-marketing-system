import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { publishDueContentRows } from '../_shared/publish-content.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const nowIso = new Date().toISOString()
    const { data: rows, error } = await supabase
      .from('content_registry')
      .select('id, org_id, platform, body, subject_line, media_url, scheduled_at, status, metadata')
      .in('status', ['scheduled', 'approved'])
      .lte('scheduled_at', nowIso)
      .neq('platform', 'design_brief')
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error) throw new Error(`Failed to load scheduled content: ${error.message}`)

    if (!rows || rows.length === 0) {
      return jsonResponse({ ok: true, published: 0, failed: 0, skipped: 0, message: 'No scheduled posts ready to publish' })
    }

    const summary = await publishDueContentRows({
      supabase,
      rows,
      claimPrefix: 'publish-scheduled',
    })

    return jsonResponse({
      ok: true,
      ...summary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('publish-scheduled failed:', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
