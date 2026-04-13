export type IntegrationCapability =
  | 'fetch_comments'
  | 'post_reply'
  | 'publish_post'
  | 'post_poll'
  | 'fetch_metrics'
  | 'send_message'
  | 'fetch_content_feed'
  | 'fetch_signups'

// Deterministic cadence policy per channel.
// Scheduling is a rule engine, not an LLM decision.
// All times UTC. Timezone offset is an org-level concern deferred to post-M13.
export type CadencePolicy = {
  launch_blast: boolean           // fire on day 0 alongside all other platforms
  sustaining_interval_days: number // min days between sustaining (post-launch) posts
  preferred_days: string[]         // weekday targets e.g. ["tuesday", "thursday"]
  preferred_time_utc: string       // HH:MM — preferred send time
  max_posts_per_campaign: number   // hard cap; scheduler will not exceed this
}

export type IntegrationDefinition = {
  id: string
  label: string
  kind: 'social' | 'content' | 'messaging' | 'analytics'
  capabilities: IntegrationCapability[]
  mocked: boolean
  enabled_by_capability?: string | null
  cadence_policy?: CadencePolicy
}

export const INTEGRATION_REGISTRY = {
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    kind: 'social',
    capabilities: ['fetch_comments', 'post_reply', 'publish_post', 'post_poll', 'fetch_metrics'],
    mocked: false,
    enabled_by_capability: 'facebook_enabled',
    // Tuesday + Thursday — peak engagement days for educational content in SSA markets.
    // Two posts per campaign: launch blast on day 0 + one sustaining post mid-window.
    cadence_policy: {
      launch_blast: true,
      sustaining_interval_days: 5,
      preferred_days: ['tuesday', 'thursday'],
      preferred_time_utc: '08:00',
      max_posts_per_campaign: 2,
    },
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    kind: 'messaging',
    capabilities: ['fetch_comments', 'post_reply', 'publish_post', 'post_poll', 'send_message', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'whatsapp_enabled',
    // Wednesday + Saturday — mid-week alert + weekend study-prep reminder.
    // Ambassador talking points post fires later to give reps time to use the launch blast.
    cadence_policy: {
      launch_blast: true,
      sustaining_interval_days: 5,
      preferred_days: ['wednesday', 'saturday'],
      preferred_time_utc: '07:30',
      max_posts_per_campaign: 2,
    },
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    kind: 'social',
    capabilities: ['fetch_comments', 'publish_post', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'youtube_enabled',
    // Thursday only — community posts perform best mid-week.
    // One post per campaign: drives comments and awareness of the campaign.
    cadence_policy: {
      launch_blast: true,
      sustaining_interval_days: 7,
      preferred_days: ['thursday'],
      preferred_time_utc: '09:00',
      max_posts_per_campaign: 1,
    },
  },
  email: {
    id: 'email',
    label: 'Email',
    kind: 'messaging',
    capabilities: ['publish_post', 'send_message', 'fetch_metrics'],
    mocked: true,
    enabled_by_capability: 'email_enabled',
    // Tuesday only — highest open rates for educational/exam-prep email.
    // One send per campaign: email fatigue is real; quality over frequency.
    cadence_policy: {
      launch_blast: true,
      sustaining_interval_days: 7,
      preferred_days: ['tuesday'],
      preferred_time_utc: '09:00',
      max_posts_per_campaign: 1,
    },
  },
  studyhub: {
    id: 'studyhub',
    label: 'StudyHub',
    kind: 'content',
    capabilities: ['fetch_content_feed', 'fetch_signups'],
    mocked: true,
    enabled_by_capability: 'studyhub_enabled',
    // No cadence_policy — StudyHub is a data source, not a publishing channel.
  },
} as const satisfies Record<string, IntegrationDefinition>

export function getIntegrationDefinition(integrationKey: keyof typeof INTEGRATION_REGISTRY) {
  return INTEGRATION_REGISTRY[integrationKey]
}

