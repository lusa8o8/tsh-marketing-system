import { getIntegrationDefinition } from './integration-registry.ts'

type PlatformConnection = Record<string, string | boolean | null | undefined>

type PublishableContentRow = {
  id: string
  org_id: string
  platform: string
  body: string
  subject_line?: string | null
  media_url?: string | null
  scheduled_at?: string | null
  status: string
  metadata?: Record<string, unknown> | null
}

type OrgPublishConfig = {
  org_id: string
  org_name: string
  platform_connections: Record<string, PlatformConnection | undefined>
}

type PublishDispatchResult = {
  external_id?: string
  raw?: unknown
}

export type PublishOutcome = {
  id: string
  platform: string
  outcome: 'published' | 'failed' | 'skipped'
  error?: string
  external_id?: string
}

export type PublishSummary = {
  published: number
  failed: number
  skipped: number
  results: PublishOutcome[]
}

const IMPLEMENTED_PUBLISHERS = new Set<string>(['facebook'])

export function isPublisherImplemented(platform: string) {
  return IMPLEMENTED_PUBLISHERS.has(platform)
}

export function getImplementedPublisherPlatforms() {
  return Array.from(IMPLEMENTED_PUBLISHERS)
}

export async function publishDueContentRows(params: {
  supabase: any
  rows: PublishableContentRow[]
  claimPrefix?: string
}): Promise<PublishSummary> {
  const { supabase, rows, claimPrefix = 'publisher' } = params

  if (!rows.length) {
    return { published: 0, failed: 0, skipped: 0, results: [] }
  }

  const orgMap = await loadOrgPublishConfigMap(
    supabase,
    [...new Set(rows.map((row) => row.org_id))],
  )

  const results: PublishOutcome[] = []

  for (const row of rows) {
    if (!isPublisherImplemented(row.platform)) {
      results.push({
        id: row.id,
        platform: row.platform,
        outcome: 'skipped',
        error: 'publisher_not_implemented',
      })
      continue
    }

    const claimed = await claimContentRow(supabase, row, claimPrefix)
    if (!claimed) {
      results.push({
        id: row.id,
        platform: row.platform,
        outcome: 'skipped',
        error: 'already_claimed_or_not_due',
      })
      continue
    }

    const orgConfig = orgMap.get(row.org_id)
    if (!orgConfig) {
      await markPublishFailed(supabase, claimed, 'org_config_not_found')
      results.push({ id: row.id, platform: row.platform, outcome: 'failed', error: 'org_config_not_found' })
      continue
    }

    const platformConnection = orgConfig.platform_connections?.[row.platform] ?? {}
    const isConnected = platformConnection.connected === true

    if (!isConnected) {
      await markPublishFailed(supabase, claimed, `${row.platform}_not_connected`)
      results.push({ id: row.id, platform: row.platform, outcome: 'failed', error: `${row.platform}_not_connected` })
      continue
    }

    try {
      const publishResult = await dispatchPublish(claimed, platformConnection, orgConfig.org_name)
      await markPublished(supabase, claimed, publishResult)
      results.push({
        id: row.id,
        platform: row.platform,
        outcome: 'published',
        external_id: publishResult.external_id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await markPublishFailed(supabase, claimed, message)
      results.push({ id: row.id, platform: row.platform, outcome: 'failed', error: message })
    }
  }

  return {
    published: results.filter((row) => row.outcome === 'published').length,
    failed: results.filter((row) => row.outcome === 'failed').length,
    skipped: results.filter((row) => row.outcome === 'skipped').length,
    results,
  }
}

async function loadOrgPublishConfigMap(supabase: any, orgIds: string[]) {
  const map = new Map<string, OrgPublishConfig>()
  if (!orgIds.length) return map

  const { data, error } = await supabase
    .from('org_config')
    .select('org_id, org_name, platform_connections')
    .in('org_id', orgIds)

  if (error) throw new Error(`Failed to load org publishing config: ${error.message}`)

  for (const row of data ?? []) {
    map.set(row.org_id, {
      org_id: row.org_id,
      org_name: row.org_name ?? 'Organisation',
      platform_connections: row.platform_connections ?? {},
    })
  }

  return map
}

async function claimContentRow(supabase: any, row: PublishableContentRow, claimPrefix: string) {
  const nowIso = new Date().toISOString()
  const nextMetadata = {
    ...((row.metadata && typeof row.metadata === 'object') ? row.metadata : {}),
    publish_claimed_at: nowIso,
    publish_claim_id: `${claimPrefix}:${row.id}:${nowIso}`,
  }

  const { data, error } = await supabase
    .from('content_registry')
    .update({
      status: 'publishing',
      metadata: nextMetadata,
    })
    .eq('id', row.id)
    .in('status', ['scheduled', 'approved'])
    .select('id, org_id, platform, body, subject_line, media_url, scheduled_at, status, metadata')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to claim content row ${row.id}: ${error.message}`)
  }

  return data as PublishableContentRow
}

async function markPublished(supabase: any, row: PublishableContentRow, publishResult: PublishDispatchResult) {
  const nextMetadata = {
    ...((row.metadata && typeof row.metadata === 'object') ? row.metadata : {}),
    publish_error: null,
    published_via: row.platform,
    published_external_id: publishResult.external_id ?? null,
    published_response: publishResult.raw ?? null,
  }

  const { error } = await supabase
    .from('content_registry')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      metadata: nextMetadata,
    })
    .eq('id', row.id)
    .eq('status', 'publishing')

  if (error) throw new Error(`Failed to mark content row ${row.id} as published: ${error.message}`)
}

async function markPublishFailed(supabase: any, row: PublishableContentRow, message: string) {
  const nextMetadata = {
    ...((row.metadata && typeof row.metadata === 'object') ? row.metadata : {}),
    publish_error: message,
    failed_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('content_registry')
    .update({
      status: 'failed',
      metadata: nextMetadata,
    })
    .eq('id', row.id)
    .eq('status', 'publishing')

  if (error) throw new Error(`Failed to mark content row ${row.id} as failed: ${error.message}`)
}

async function dispatchPublish(
  row: PublishableContentRow,
  platformConnection: PlatformConnection,
  orgName: string,
): Promise<PublishDispatchResult> {
  switch (row.platform) {
    case getIntegrationDefinition('facebook').id:
      return await publishFacebook(row, platformConnection)
    case getIntegrationDefinition('whatsapp').id:
      throw new Error('WhatsApp live publisher scaffolded but not implemented yet')
    case getIntegrationDefinition('youtube').id:
      throw new Error('YouTube live publisher scaffolded but not implemented yet')
    case getIntegrationDefinition('email').id:
      throw new Error('Email live publisher scaffolded but not implemented yet')
    default:
      throw new Error(`No publisher registered for platform ${row.platform} (${orgName})`)
  }
}

async function publishFacebook(row: PublishableContentRow, platformConnection: PlatformConnection): Promise<PublishDispatchResult> {
  const pageId = String(platformConnection.page_id ?? '').trim()
  const accessToken = String(platformConnection.access_token ?? '').trim()

  if (!pageId || !accessToken) {
    throw new Error('Missing Facebook credentials: page_id and access_token are required')
  }

  const params = new URLSearchParams()
  params.set('access_token', accessToken)

  let endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`
  if (row.media_url) {
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/photos`
    params.set('url', row.media_url)
    params.set('caption', row.body)
    params.set('published', 'true')
  } else {
    params.set('message', row.body)
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message ?? response.statusText
    throw new Error(`Facebook Graph API error ${response.status}: ${message}`)
  }

  return {
    external_id: typeof payload?.id === 'string' ? payload.id : undefined,
    raw: payload,
  }
}
