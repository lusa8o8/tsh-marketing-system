export type IntegrationCapability =
  | 'fetch_comments'
  | 'post_reply'
  | 'publish_post'
  | 'post_poll'
  | 'fetch_metrics'
  | 'send_message'
  | 'fetch_content_feed'
  | 'fetch_signups'

export type IntegrationDefinition = {
  id: string
  label: string
  kind: 'social' | 'content' | 'messaging' | 'analytics'
  capabilities: IntegrationCapability[]
  mocked: boolean
  enabled_by_capability?: string | null
}

export const INTEGRATION_REGISTRY = {
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    kind: 'social',
    capabilities: ['fetch_comments', 'post_reply', 'publish_post', 'post_poll', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'facebook_enabled',
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    kind: 'messaging',
    capabilities: ['fetch_comments', 'post_reply', 'publish_post', 'post_poll', 'send_message', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'whatsapp_enabled',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    kind: 'social',
    capabilities: ['fetch_comments', 'publish_post', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'youtube_enabled',
  },
  email: {
    id: 'email',
    label: 'Email',
    kind: 'messaging',
    capabilities: ['publish_post', 'send_message', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'email_enabled',
  },
  studyhub: {
    id: 'studyhub',
    label: 'StudyHub',
    kind: 'content',
    capabilities: ['fetch_content_feed', 'fetch_signups'],
    mocked: true,
    enabled_by_capability: 'studyhub_enabled',
  },
} as const satisfies Record<string, IntegrationDefinition>

export function getIntegrationDefinition(integrationKey: keyof typeof INTEGRATION_REGISTRY) {
  return INTEGRATION_REGISTRY[integrationKey]
}
