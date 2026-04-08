# Wiring instructions — TSH Marketing OS dashboard

## What needs to happen
The UI imports all its data hooks from `@workspace/api-client-react`.
That package is currently a stub/mock. We need to implement it with
real Supabase queries. The UI pages do NOT need to change at all.

## Step 1 — add environment variables

Create a `.env` file in the project root (if it doesn't exist):
```
VITE_SUPABASE_URL=https://jxmdwltfkxstiwnwwiuf.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key from Supabase dashboard → Settings → API>
```

## Step 2 — create src/lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
```

## Step 3 — find where @workspace/api-client-react is defined

Run: `find . -path ./node_modules -prune -o -name "*.ts" -print | xargs grep -l "useListInboxItems" 2>/dev/null`

This will show where the hook stubs live. It's likely in one of:
- `packages/api-client-react/src/index.ts`
- `packages/api-client/index.ts`
- A workspace package defined in package.json workspaces

## Step 4 — implement every hook

Find the api-client-react package and replace ALL hook implementations
with real Supabase queries. Here is the implementation for every hook
the UI uses:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase, ORG_ID } from '../../src/lib/supabase'
// adjust the import path based on where this file lives

// ── INBOX ──────────────────────────────────────────────────────────

export function getGetInboxSummaryQueryKey() {
  return ['inbox-summary', ORG_ID]
}

export function useGetInboxSummary() {
  return useQuery({
    queryKey: getGetInboxSummaryQueryKey(),
    queryFn: async () => {
      const { count } = await supabase
        .from('human_inbox')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', ORG_ID)
        .eq('status', 'pending')
      return { unread: count ?? 0 }
    }
  })
}

export function getListInboxItemsQueryKey(params?: any) {
  return ['inbox-items', ORG_ID, params]
}

export function useListInboxItems(params?: {
  priority?: 'urgent' | 'normal' | 'fyi'
  status?: 'pending' | 'approved' | 'rejected' | 'actioned'
}, options?: any) {
  return useQuery({
    queryKey: getListInboxItemsQueryKey(params),
    queryFn: async () => {
      let query = supabase
        .from('human_inbox')
        .select('*')
        .eq('org_id', ORG_ID)
        // exclude draft_approval — those live in content registry now
        .neq('item_type', 'draft_approval')
        .order('created_at', { ascending: false })

      if (params?.priority === 'fyi') {
        query = query.eq('priority', 'fyi')
      } else if (params?.priority === 'urgent') {
        query = query.eq('priority', 'urgent')
      } else if (params?.status === 'pending') {
        query = query.eq('status', 'pending')
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

export function useActionInboxItem(options?: any) {
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string
      data: { action: 'approve' | 'reject' | 'read'; note?: string }
    }) => {
      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        read: 'actioned'
      }

      const { error } = await supabase
        .from('human_inbox')
        .update({
          status: statusMap[data.action],
          actioned_at: new Date().toISOString(),
          action_note: data.note ?? null
        })
        .eq('id', id)

      if (error) throw error

      // if approving a campaign_brief, no content_registry update needed
      // if rejecting/approving draft_approvals (legacy), update content_registry
      return { success: true }
    },
    ...options?.mutation
  })
}

// ── CONTENT ────────────────────────────────────────────────────────

export function getListContentQueryKey(params?: any) {
  return ['content', ORG_ID, params]
}

export function useListContent(params?: {
  status?: 'draft' | 'scheduled' | 'published' | 'failed' | 'rejected'
}, options?: any) {
  return useQuery({
    queryKey: getListContentQueryKey(params),
    queryFn: async () => {
      let query = supabase
        .from('content_registry')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('created_at', { ascending: false })

      if (params?.status) {
        query = query.eq('status', params.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

export function useRetryContent(options?: any) {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('content_registry')
        .update({ status: 'draft' })
        .eq('id', id)
      if (error) throw error
    },
    ...options?.mutation
  })
}

export function useActionContent(options?: any) {
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string
      data: { action: 'approve' | 'reject'; note?: string }
    }) => {
      const newStatus = data.action === 'approve' ? 'approved' : 'rejected'
      const { error } = await supabase
        .from('content_registry')
        .update({ status: newStatus })
        .eq('id', id)
      if (error) throw error
    },
    ...options?.mutation
  })
}

// ── METRICS ────────────────────────────────────────────────────────

export function useListMetrics(options?: any) {
  return useQuery({
    queryKey: ['metrics', ORG_ID],
    queryFn: async () => {
      // get the latest snapshot per platform
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('snapshot_date', { ascending: false })
        .limit(8)

      if (error) throw error

      // dedupe: one row per platform (most recent)
      const seen = new Set()
      return (data ?? []).filter(row => {
        if (seen.has(row.platform)) return false
        seen.add(row.platform)
        return true
      }).map(row => ({
        ...row,
        followers_change: null, // calculate from history if needed
        reach_change: null,
        engagement_change: null,
        signups_change: null
      }))
    },
    ...options?.query
  })
}

export function useGetMetricsSparklines(options?: any) {
  return useQuery({
    queryKey: ['metrics-sparklines', ORG_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('platform, signups, snapshot_date')
        .eq('org_id', ORG_ID)
        .order('snapshot_date', { ascending: true })
        .limit(28) // last 7 days × 4 platforms

      if (error) throw error

      // group by platform, return array of { date, value } per platform
      const grouped: Record<string, { date: string; value: number }[]> = {}
      for (const row of data ?? []) {
        if (!grouped[row.platform]) grouped[row.platform] = []
        grouped[row.platform].push({
          date: row.snapshot_date,
          value: row.signups
        })
      }
      return grouped
    },
    ...options?.query
  })
}

// ── AMBASSADORS ────────────────────────────────────────────────────

export function getListAmbassadorsQueryKey() {
  return ['ambassadors', ORG_ID]
}

export function useListAmbassadors(options?: any) {
  return useQuery({
    queryKey: getListAmbassadorsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_registry')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

export function useUpdateAmbassador(options?: any) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('ambassador_registry')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    ...options?.mutation
  })
}

export function useDeleteAmbassador(options?: any) {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('ambassador_registry')
        .update({ status: 'inactive' })
        .eq('id', id)
      if (error) throw error
    },
    ...options?.mutation
  })
}

export function useCreateAmbassador(options?: any) {
  return useMutation({
    mutationFn: async ({ data }: { data: any }) => {
      const { error } = await supabase
        .from('ambassador_registry')
        .insert({ ...data, org_id: ORG_ID, status: 'active' })
      if (error) throw error
    },
    ...options?.mutation
  })
}

// ── CALENDAR ───────────────────────────────────────────────────────

export function getListCalendarEventsQueryKey() {
  return ['calendar', ORG_ID]
}

export function useListCalendarEvents(options?: any) {
  return useQuery({
    queryKey: getListCalendarEventsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_calendar')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('event_date', { ascending: true })
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

export function useCreateCalendarEvent(options?: any) {
  return useMutation({
    mutationFn: async ({ data }: { data: any }) => {
      const { error } = await supabase
        .from('academic_calendar')
        .insert({ ...data, org_id: ORG_ID, triggered: false })
      if (error) throw error
    },
    ...options?.mutation
  })
}

// ── PIPELINE RUNS ──────────────────────────────────────────────────

export function useGetPipelinesStatus(options?: any) {
  return useQuery({
    queryKey: ['pipeline-status', ORG_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('started_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const pipelines = ['coordinator', 'pipeline-a-engagement', 'pipeline-b-weekly', 'pipeline-c-campaign']
      const descriptions: Record<string, string> = {
        'coordinator': 'Fires daily, reads calendar, triggers pipelines',
        'pipeline-a-engagement': 'Daily comment processing and engagement',
        'pipeline-b-weekly': 'Weekly content planning and publishing',
        'pipeline-c-campaign': 'Campaign engine triggered by calendar'
      }

      const result: Record<string, any> = {}
      const keys = ['coordinator', 'pipeline_a', 'pipeline_b', 'pipeline_c']
      const pipelineNames = ['coordinator', 'pipeline-a-engagement', 'pipeline-b-weekly', 'pipeline-c-campaign']

      for (let i = 0; i < pipelines.length; i++) {
        const name = pipelineNames[i]
        const key = keys[i]
        const runs = (data ?? []).filter(r => r.pipeline === name)
        const latest = runs[0]
        result[key] = {
          pipeline: name,
          description: descriptions[name],
          status: latest?.status ?? 'idle',
          last_run: latest?.started_at ?? null,
          duration: latest?.finished_at && latest?.started_at
            ? `${((new Date(latest.finished_at).getTime() - new Date(latest.started_at).getTime()) / 1000).toFixed(1)}s`
            : null,
          result_summary: latest?.result
            ? Object.entries(latest.result)
                .filter(([k]) => !['error', 'events'].includes(k))
                .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                .slice(0, 3)
                .join(' · ')
            : null,
          error: latest?.result?.error ?? null
        }
      }

      return result
    },
    refetchInterval: 10000, // refresh every 10s to catch running pipelines
    ...options?.query
  })
}

export function useListPipelineRuns(params?: { limit?: number }, options?: any) {
  return useQuery({
    queryKey: ['pipeline-runs', ORG_ID, params],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('*')
        .eq('org_id', ORG_ID)
        .order('started_at', { ascending: false })
        .limit(params?.limit ?? 10)
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

// ── ORG CONFIG ─────────────────────────────────────────────────────

export function getGetOrgConfigQueryKey() {
  return ['org-config', ORG_ID]
}

export function useGetOrgConfig(options?: any) {
  return useQuery({
    queryKey: getGetOrgConfigQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_config')
        .select('*')
        .eq('org_id', ORG_ID)
        .single()
      if (error) throw error
      return data
    },
    ...options?.query
  })
}

export function useUpdateOrgConfig(options?: any) {
  return useMutation({
    mutationFn: async ({ data }: { data: any }) => {
      // handle nested jsonb fields correctly
      const update: any = {}

      if (data.org_name) update.org_name = data.org_name
      if (data.full_name) update.org_full_name = data.full_name
      if (data.country) update.country = data.country
      if (data.timezone) update.timezone = data.timezone
      if (data.contact_email) update.contact_email = data.contact_email
      if (data.brand_voice) update.brand_voice = data.brand_voice
      if (data.pipeline_config) update.pipeline_config = data.pipeline_config
      if (data.kpi_targets) update.kpi_targets = data.kpi_targets

      const { error } = await supabase
        .from('org_config')
        .update(update)
        .eq('org_id', ORG_ID)

      if (error) throw error
    },
    ...options?.mutation
  })
}
```

## Step 5 — fix hardcoded org name in layout.tsx

In `src/components/layout.tsx`, find the hardcoded "TSH" text:
```tsx
<h1 className="font-bold text-lg leading-tight">TSH</h1>
<p className="text-xs text-muted-foreground font-medium">Marketing OS</p>
```

Replace with:
```tsx
const { data: config } = useGetOrgConfig()
// add this hook call inside SidebarContent component

// then in the JSX:
<h1 className="font-bold text-lg leading-tight">{config?.org_name ?? 'TSH'}</h1>
<p className="text-xs text-muted-foreground font-medium">Marketing OS</p>
```

Also update the avatar fallback and org name at the bottom of sidebar:
```tsx
// replace hardcoded "OP" and "TSH Operations" with:
<AvatarFallback>
  {config?.org_name?.slice(0, 2).toUpperCase() ?? 'OP'}
</AvatarFallback>
<p className="text-sm font-medium truncate">{config?.org_full_name ?? config?.org_name ?? 'TSH Operations'}</p>
```

## Step 6 — install supabase client if not already installed

```bash
npm install @supabase/supabase-js
```

## Step 7 — verify

After implementing, run the dev server and check:
1. Inbox shows real rows from human_inbox (should see 9+ items)
2. Content → Drafts shows 14 draft posts
3. Metrics shows 4 platforms with real numbers
4. Calendar shows 19 events
5. Agent Manager → Overview shows pipeline run history
6. Settings loads TSH brand voice from org_config
7. Sidebar shows "TSH" from org_config not hardcoded

## Notes
- The chat page (agent/chat.tsx) uses mock messages intentionally
  and will be wired to a real Anthropic API call in a later step
  when we build the coordinator chat endpoint
- `useDeleteAmbassador` soft-deletes (sets status: inactive) rather
  than hard-deleting — this preserves history
- Pipeline status cards auto-refresh every 10 seconds so you can
  watch a pipeline run in real time after triggering from chat
