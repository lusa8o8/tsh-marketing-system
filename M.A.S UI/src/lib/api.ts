import { useMutation, useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getAccessToken, getOrgId, supabase } from "@/lib/supabase";

type QueryHookOptions = { query?: Record<string, any> };
type MutationHookOptions = { mutation?: Record<string, any> };

type InboxFilter = {
  status?: string;
  priority?: string;
  limit?: number;
};

type ContentFilter = {
  status?: string;
  limit?: number;
  created_by?: string;
};

type PipelineRunsFilter = {
  limit?: number;
};

type OrgConfig = {
  id?: string;
  org_id?: string;
  org_name: string;
  full_name: string;
  country: string;
  timezone: string;
  contact_email: string;
  brand_voice: {
    tone: string;
    target_audience: string;
    always_say: string[];
    never_say: string[];
    preferred_cta: string;
    good_post_example: string;
    bad_post_example: string;
    hashtags: string[];
    post_format_preference: string;
  };
  brand_visual: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    font_heading: string;
    font_body: string;
    logo_usage_rules: string;
    logo_file_note: string;
    visual_style: string;
    photography_style: string;
    layout_preference: string;
  };
  markdown_design_spec: string;
  social_handles: {
    youtube: string;
    facebook: string;
    whatsapp: string;
    instagram: string;
    tiktok: string;
    studyhub_url: string;
  };
  primary_cta_url: string;
  platform_connections: Record<string, unknown>;
  pipeline_config: {
    pipeline_a_enabled: boolean;
    pipeline_a_run_time: string;
    pipeline_b_enabled: boolean;
    pipeline_b_run_day: string;
    pipeline_b_run_time: string;
    pipeline_c_enabled: boolean;
    pipeline_c_auto_approve: boolean;
  };
  kpi_targets: Record<string, number>;
};

const PIPELINE_DESCRIPTIONS: Record<string, string> = {
  coordinator: "Orchestrates all pipelines and schedules.",
  pipeline_a: "Processes engagement and escalations.",
  pipeline_b: "Drafts and schedules social content.",
  pipeline_c: "Generates and sends campaign briefs.",
  pipeline_d: "Drafts one-off posts on request.",
};

const PLATFORM_ORDER = ["facebook", "whatsapp", "youtube", "email"];

const PIPELINE_RUN_STATUS = {
  idle: 'idle',
  queued: 'queued',
  running: 'running',
  waiting_human: 'waiting_human',
  resumed: 'resumed',
  success: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toPipelineKey(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("pipeline-a")) return "pipeline_a";
  if (normalized.includes("pipeline-b")) return "pipeline_b";
  if (normalized.includes("pipeline-c")) return "pipeline_c";
  if (normalized === "pipeline_a") return "pipeline_a";
  if (normalized === "pipeline_b") return "pipeline_b";
  if (normalized.includes("pipeline-d")) return "pipeline_d";
  if (normalized === "pipeline_c") return "pipeline_c";
  if (normalized === "pipeline_d") return "pipeline_d";
  return "coordinator";
}

function toUiContentStatus(status?: string | null) {
  if (status === "pending_approval") return "draft";
  if (status === "approved") return "scheduled";
  return status ?? "draft";
}

function getContentStatusFilter(status?: string) {
  if (status === "draft") return ["pending_approval", "draft", "rejected"];
  if (status === "scheduled") return ["scheduled", "approved"];
  if (status === "published") return ["published"];
  if (status === "failed") return ["failed"];
  return [];
}

function calculatePercentChange(current?: number | null, previous?: number | null) {
  if (!current || !previous) return 0;
  if (previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function calculateDurationSeconds(row: any) {
  if (typeof row.duration_seconds === "number") return row.duration_seconds;
  const startedAt = row.started_at ?? row.created_at;
  const finishedAt = row.finished_at ?? row.updated_at;
  if (!startedAt || !finishedAt) return null;
  const seconds = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function summarizeRun(row: any) {
  if (row.result_summary) return row.result_summary;
  if (row.error_message) return row.error_message;
  if (row.result?.error) return row.result.error;

  const result = row.result ?? {};
  if (row.status === "failed") {
    return "Execution failed";
  }

  if (row.pipeline === "coordinator" || row.pipeline === "Coordinator") {
    const pipelines = result.pipelines_fired ?? 0;
    const events = result.calendar_events_triggered ?? 0;
    return `Checked pipeline health, ${pipelines} pipelines fired, ${events} calendar events triggered`;
  }

  if ("comments_processed" in result) {
    return `${result.comments_processed ?? 0} comments processed, ${result.escalations ?? 0} escalations flagged`;
  }

  if ("posts_drafted" in result) {
    return `${result.posts_drafted ?? 0} posts drafted, ${result.drafts_sent_for_approval ?? 0} queued for review`;
  }

  if ("campaign_brief_sent" in result) {
    return result.campaign_name
      ? `Campaign brief generated for ${result.campaign_name}`
      : "Campaign brief generated and sent to inbox";
  }

  return "-";
}

function getPlatformLabel(platform?: string | null) {
  const value = platform ?? "";
  if (value === "studyhub") return "StudyHub";
  return titleCase(value);
}

function normalizeInboxPayload(row: any) {
  const payload = row.payload ?? {};
  const platformLabel = getPlatformLabel(payload.platform);

  if (row.item_type === "campaign_brief") {
    const brief = payload.campaign_brief ?? {};
    const universities = (brief.universities ?? payload.universities ?? []).join(" & ");
    return {
      ...payload,
      title: brief.name ?? payload.title ?? payload.event_label ?? "Campaign Brief",
      preview:
        payload.preview ??
        `${brief.duration_days ?? ""}-week campaign targeting ${brief.target_audience ?? (universities || "students")}...`.replace(
          /^\-week/,
          "Campaign"
        ),
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_c"),
    };
  }

  if (row.item_type === "weekly_report") {
    const report = payload.report ?? payload.body ?? "Weekly report available.";
    return {
      ...payload,
      title: payload.title ?? `Weekly Performance Report ${payload.week_ending ? `- ${payload.week_ending}` : ""}`.trim(),
      preview: payload.preview ?? report,
      body: report,
      pipeline: "Coordinator",
    };
  }

  if (row.item_type === "campaign_report") {
    const report = payload.report ?? payload.body ?? "Campaign report available.";
    return {
      ...payload,
      title: payload.title ?? `${payload.campaign_name ?? "Campaign"} Performance Report`,
      preview: payload.preview ?? report,
      body: report,
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_c"),
    };
  }

  if (row.item_type === "escalation") {
    const comment = payload.original_comment ?? payload.comment_text ?? "";
    const author = payload.author ? `${payload.author} ` : "";
    return {
      ...payload,
      title:
        payload.title ??
        `Angry comment on ${platformLabel || "platform"} - ${author}needs attention`.replace(/\s+/g, " ").trim(),
      preview: payload.preview ?? comment,
      original_comment: comment,
      suggested_response: payload.suggested_response,
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_a"),
    };
  }

  if (row.item_type === "ambassador_flag") {
    const lastCheckin = payload.last_checkin
      ? `${Math.max(
          0,
          Math.round((Date.now() - new Date(payload.last_checkin).getTime()) / (1000 * 60 * 60 * 24))
        )} days ago`
      : "Never";
    const reason = payload.reason ?? "Check-in overdue";
    return {
      ...payload,
      title: payload.title ?? `Ambassador ${payload.name ?? ""} - missed check-ins`.trim(),
      preview:
        payload.preview ??
        `${payload.name ?? "This ambassador"} from ${payload.university ?? "campus"} has not checked in since ${lastCheckin}.`,
      body: payload.body ?? `${reason}. ${payload.suggestion ?? ""}`.trim(),
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_a"),
    };
  }

  if (row.item_type === "suggestion") {
    return {
      ...payload,
      title: payload.title ?? titleCase(payload.type ?? "suggestion"),
      preview: payload.preview ?? payload.suggestion ?? payload.brief ?? "Suggestion available.",
      body: payload.body ?? payload.suggestion ?? payload.brief,
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_a"),
    };
  }

  if (row.item_type === "draft_approval") {
    return {
      ...payload,
      title: payload.title ?? `${platformLabel} draft awaiting approval`,
      preview: payload.preview ?? payload.body ?? "",
      pipeline: titleCase(row.created_by_pipeline ?? "pipeline_b"),
    };
  }

  return {
    ...payload,
    title: payload.title ?? titleCase(row.item_type ?? "inbox item"),
    preview: payload.preview ?? payload.body ?? "",
    pipeline: titleCase(row.created_by_pipeline ?? ""),
  };
}

function normalizeOrgConfig(row: any): OrgConfig {
  const brandVoice = row?.brand_voice ?? {};
  const pipelineConfig = row?.pipeline_config ?? {};

  return {
    id: row?.id,
    org_id: row?.org_id,
    org_name: row?.org_name ?? row?.short_name ?? brandVoice.name ?? "",
    full_name: row?.full_name ?? row?.legal_name ?? brandVoice.full_name ?? "",
    country: row?.country ?? "",
    timezone: row?.timezone ?? "",
    contact_email: row?.contact_email ?? "",
    brand_voice: {
      tone: brandVoice.tone ?? "",
      target_audience: brandVoice.target_audience ?? "",
      always_say: brandVoice.always_say ?? [],
      never_say: brandVoice.never_say ?? [],
      preferred_cta: brandVoice.preferred_cta ?? brandVoice.cta_preference ?? "",
      good_post_example: brandVoice.good_post_example ?? brandVoice.example_good_post ?? "",
      bad_post_example: brandVoice.bad_post_example ?? brandVoice.example_bad_post ?? "",
      hashtags: brandVoice.hashtags ?? [],
      post_format_preference: brandVoice.post_format_preference ?? "",
    },
    brand_visual: {
      primary_color: row?.brand_visual?.primary_color ?? "",
      secondary_color: row?.brand_visual?.secondary_color ?? "",
      accent_color: row?.brand_visual?.accent_color ?? "",
      background_color: row?.brand_visual?.background_color ?? "",
      font_heading: row?.brand_visual?.font_heading ?? "",
      font_body: row?.brand_visual?.font_body ?? "",
      logo_usage_rules: row?.brand_visual?.logo_usage_rules ?? "",
      logo_file_note: row?.brand_visual?.logo_file_note ?? "",
      visual_style: row?.brand_visual?.visual_style ?? "",
      photography_style: row?.brand_visual?.photography_style ?? "",
      layout_preference: row?.brand_visual?.layout_preference ?? "",
    },
    markdown_design_spec: row?.markdown_design_spec ?? "",
    social_handles: {
      youtube: row?.social_handles?.youtube ?? "",
      facebook: row?.social_handles?.facebook ?? "",
      whatsapp: row?.social_handles?.whatsapp ?? "",
      instagram: row?.social_handles?.instagram ?? "",
      tiktok: row?.social_handles?.tiktok ?? "",
      studyhub_url: row?.social_handles?.studyhub_url ?? "",
    },
    primary_cta_url: row?.primary_cta_url ?? "",
    platform_connections: row?.platform_connections ?? {},
    pipeline_config: {
      pipeline_a_enabled: pipelineConfig.pipeline_a_enabled ?? pipelineConfig.pipeline_a?.enabled ?? false,
      pipeline_a_run_time: pipelineConfig.pipeline_a_run_time ?? pipelineConfig.pipeline_a?.run_time ?? "06:30",
      pipeline_b_enabled: pipelineConfig.pipeline_b_enabled ?? pipelineConfig.pipeline_b?.enabled ?? false,
      pipeline_b_run_day: pipelineConfig.pipeline_b_run_day ?? pipelineConfig.pipeline_b?.run_day ?? "Monday",
      pipeline_b_run_time: pipelineConfig.pipeline_b_run_time ?? pipelineConfig.pipeline_b?.run_time ?? "09:00",
      pipeline_c_enabled: pipelineConfig.pipeline_c_enabled ?? pipelineConfig.pipeline_c?.enabled ?? false,
      pipeline_c_auto_approve:
        pipelineConfig.pipeline_c_auto_approve ?? pipelineConfig.pipeline_c?.auto_approve ?? false,
    },
    kpi_targets: row?.kpi_targets ?? {},
  };
}

function toStoredPipelineConfig(pipelineConfig: OrgConfig["pipeline_config"]) {
  return {
    pipeline_a: {
      enabled: pipelineConfig.pipeline_a_enabled,
      run_time: pipelineConfig.pipeline_a_run_time,
    },
    pipeline_b: {
      enabled: pipelineConfig.pipeline_b_enabled,
      run_day: pipelineConfig.pipeline_b_run_day,
      run_time: pipelineConfig.pipeline_b_run_time,
    },
    pipeline_c: {
      enabled: pipelineConfig.pipeline_c_enabled,
      auto_approve: pipelineConfig.pipeline_c_auto_approve,
    },
  };
}

function toStoredBrandVoice(brandVoice: OrgConfig["brand_voice"], current?: any) {
  return {
    ...(current ?? {}),
    tone: brandVoice.tone,
    target_audience: brandVoice.target_audience,
    always_say: brandVoice.always_say,
    never_say: brandVoice.never_say,
    preferred_cta: brandVoice.preferred_cta,
    cta_preference: brandVoice.preferred_cta,
    good_post_example: brandVoice.good_post_example,
    example_good_post: brandVoice.good_post_example,
    bad_post_example: brandVoice.bad_post_example,
    example_bad_post: brandVoice.bad_post_example,
    hashtags: brandVoice.hashtags ?? [],
    post_format_preference: brandVoice.post_format_preference ?? "",
  };
}

async function requireSingleRow(table: string, id: string) {
  const { data, error } = await supabase.from(table).select("*").eq("org_id", getOrgId()).eq("id", id).single();
  if (error) throw error;
  return data;
}

async function readFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const context = error.context;
      const cloned = typeof context?.clone === "function" ? context.clone() : context;
      const payload = await cloned.json();
      if (typeof payload?.error === "string" && payload.error) return payload.error;
      if (typeof payload?.message === "string" && payload.message) return payload.message;
      return JSON.stringify(payload);
    } catch (_jsonError) {
      try {
        const context = error.context;
        const cloned = typeof context?.clone === "function" ? context.clone() : context;
        const text = await cloned.text();
        if (text) return text;
      } catch (_textError) {
        // Fall through to generic handling below.
      }
    }
  }

  if (error instanceof Error) return error.message;
  return "The request failed.";
}

async function requestPipelineBResume() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const { error } = await supabase.functions.invoke("coordinator-chat", {
    body: {
      message: "resume pipeline b",
      history: [],
      confirmationAction: null,
      orgId: getOrgId(),
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    throw error;
  }
}

async function requestPipelineCResume() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const { error } = await supabase.functions.invoke("coordinator-chat", {
    body: {
      message: "resume pipeline c",
      history: [],
      confirmationAction: null,
      orgId: getOrgId(),
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    throw error;
  }
}

export function getGetInboxSummaryQueryKey() {
  return ["inbox-summary", getOrgId()] as const;
}

export function getListInboxItemsQueryKey(params?: InboxFilter) {
  return ["inbox-items", getOrgId(), params ?? {}] as const;
}

export function getListContentQueryKey(params?: ContentFilter) {
  return ["content-registry", getOrgId(), params ?? {}] as const;
}

export function getGetOrgConfigQueryKey() {
  return ["org-config", getOrgId()] as const;
}

export function getListAmbassadorsQueryKey() {
  return ["ambassadors", getOrgId()] as const;
}

export function getListCalendarEventsQueryKey() {
  return ["calendar-events", getOrgId()] as const;
}

export function useGetInboxSummary(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetInboxSummaryQueryKey(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("human_inbox")
        .select("*", { count: "exact", head: true })
        .eq("org_id", getOrgId())
        .eq("status", "pending");

      if (error) throw error;
      return { unread: count ?? 0 };
    },
    ...options?.query,
  });
}

export function useListInboxItems(params: InboxFilter = {}, options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListInboxItemsQueryKey(params),
    queryFn: async () => {
      let query = supabase
        .from("human_inbox")
        .select("*")
        .eq("org_id", getOrgId())
        .order("created_at", { ascending: false });

      if (params.status) query = query.eq("status", params.status);
      if (params.priority) query = query.eq("priority", params.priority);
      if (params.limit) query = query.limit(params.limit);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...row,
        payload: normalizeInboxPayload(row),
      }));
    },
    ...options?.query,
  });
}

export function useActionInboxItem(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { action: "approve" | "reject" | "read"; note?: string } }) => {
      const inboxRow = await requireSingleRow("human_inbox", id);

      const nextStatus =
        data.action === "approve" ? "approved" : data.action === "reject" ? "rejected" : "actioned";

      const { error: inboxError } = await supabase
        .from("human_inbox")
        .update({
          status: nextStatus,
          action_note: data.note ?? null,
          actioned_at: new Date().toISOString(),
          actioned_by: "ui",
        })
        .eq("id", id)
        .eq("org_id", getOrgId());

      if (inboxError) throw inboxError;

      if (inboxRow.item_type === "draft_approval") {
        const contentId = inboxRow.ref_id ?? inboxRow.payload?.content_registry_id;
        if (contentId) {
          const contentStatus = data.action === "approve" ? "scheduled" : "rejected";
          const contentPatch: Record<string, unknown> = {
            status: contentStatus,
          };

          const { error: contentError } = await supabase
            .from("content_registry")
            .update(contentPatch)
            .eq("id", contentId)
            .eq("org_id", getOrgId());

          if (contentError) throw contentError;
        }

        if (inboxRow.created_by_pipeline === "pipeline-b-weekly") {
          await requestPipelineBResume();
        }
      }

      if (inboxRow.item_type === "campaign_brief" && inboxRow.created_by_pipeline === "pipeline-c-campaign" && data.action !== "read") {
        await requestPipelineCResume();
      }

      return { id, action: data.action };
    },
    ...options?.mutation,
  });
}

export function useListContent(params: ContentFilter = {}, options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListContentQueryKey(params),
    queryFn: async () => {
      let query = supabase
        .from("content_registry")
        .select("*")
        .eq("org_id", getOrgId())
        .order("scheduled_at", { ascending: true })
        .order("created_at", { ascending: false });

      const statuses = getContentStatusFilter(params.status);
      if (statuses.length === 1) query = query.eq("status", statuses[0]);
      if (statuses.length > 1) query = query.in("status", statuses);
      if (params.created_by) query = query.eq("created_by", params.created_by);
      if (params.limit) query = query.limit(params.limit);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...row,
        status: toUiContentStatus(row.status),
      }));
    },
    ...options?.query,
  });
}

export function useRetryContent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("content_registry")
        .update({
          status: "pending_approval",
        })
        .eq("id", id)
        .eq("org_id", getOrgId());

      if (error) throw error;
      return { id };
    },
    ...options?.mutation,
  });
}

export function useActionContent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id, pipelineRunId, platform, data }: { id: string; pipelineRunId?: string | null; platform?: string | null; data: { action: "approve" | "reject"; note?: string } }) => {
      const patch: Record<string, unknown> =
        data.action === "approve"
          ? { status: "scheduled" }
          : { status: "rejected", rejection_note: data.note ?? null };

      const { error } = await supabase.from("content_registry").update(patch).eq("id", id).eq("org_id", getOrgId());
      if (error) throw error;

      // Pipeline resume gate — design_brief rows are never copy gates, skip entirely
      if (pipelineRunId && platform !== "design_brief") {
        // Look up which pipeline owns this run so we know which resume to trigger
        const { data: runRow } = await supabase
          .from("pipeline_runs")
          .select("pipeline")
          .eq("id", pipelineRunId)
          .single();

        const ownerPipeline = runRow?.pipeline ?? "";

        if (ownerPipeline.includes("pipeline-b")) {
          // Pipeline B: trigger resume when no draft rows remain for this run
          // (resume function handles both approve-all and all-rejected cases)
          const { count } = await supabase
            .from("content_registry")
            .select("id", { count: "exact", head: true })
            .eq("pipeline_run_id", pipelineRunId)
            .eq("status", "draft")
            .eq("org_id", getOrgId());

          if ((count ?? 0) === 0) {
            await requestPipelineBResume();
          }
        } else if (ownerPipeline.includes("pipeline-c")) {
          if (data.action === "reject") {
            // Rejection always triggers resume so pipeline can create revision item
            await requestPipelineCResume();
          } else {
            // Approve: only trigger if no copy draft rows remain for this run
            const { count } = await supabase
              .from("content_registry")
              .select("id", { count: "exact", head: true })
              .eq("pipeline_run_id", pipelineRunId)
              .eq("status", "draft")
              .neq("platform", "design_brief")
              .eq("org_id", getOrgId());

            if ((count ?? 0) === 0) {
              await requestPipelineCResume();
            }
          }
        }
      }

      return { id, action: data.action };
    },
    ...options?.mutation,
  });
}

export function useBatchApproveContent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ pipelineRunId }: { pipelineRunId: string }) => {
      const { error } = await supabase
        .from("content_registry")
        .update({ status: "scheduled" })
        .eq("pipeline_run_id", pipelineRunId)
        .eq("status", "draft")
        .neq("platform", "design_brief")
        .eq("org_id", getOrgId());

      if (error) throw error;

      // All drafts approved — trigger pipeline resume
      await requestPipelineCResume();

      return { pipelineRunId };
    },
    ...options?.mutation,
  });
}

export function useEditContent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id, body, subjectLine }: { id: string; body: string; subjectLine?: string | null }) => {
      // Always reset to draft and clear rejection note so the edited asset
      // can be approved normally. Works for both draft and rejected items.
      const patch: Record<string, unknown> = { body, status: "draft", rejection_note: null };
      if (subjectLine !== undefined) patch.subject_line = subjectLine;

      const { error } = await supabase
        .from("content_registry")
        .update(patch)
        .eq("id", id)
        .in("status", ["draft", "rejected"])
        .eq("org_id", getOrgId());

      if (error) throw error;
      return { id };
    },
    ...options?.mutation,
  });
}

export function useUploadContentImage(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${getOrgId()}/${id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("content-media")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("content-media")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("content_registry")
        .update({ media_url: publicUrl })
        .eq("id", id)
        .eq("org_id", getOrgId());

      if (updateError) throw updateError;

      return { id, media_url: publicUrl };
    },
    ...options?.mutation,
  });
}

export function useGetPipelinesStatus(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? ["pipeline-status", getOrgId()],
    queryFn: async () => {
      const [{ data, error }, { data: pipelineDRow, error: pipelineDError }] = await Promise.all([
        supabase
          .from("pipeline_runs")
          .select("*")
          .eq("org_id", getOrgId())
          .order("started_at", { ascending: false })
          .limit(40),
        supabase
          .from("content_registry")
          .select("id, created_at, updated_at, status, created_by")
          .eq("org_id", getOrgId())
          .eq("created_by", "pipeline-d-post")
          .eq("is_campaign_post", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (error) throw error;
      if (pipelineDError) throw pipelineDError;

      const latest: Record<string, any> = {};
      for (const row of data ?? []) {
        const key = toPipelineKey(row.pipeline);
        if (!latest[key]) latest[key] = row;
      }

      const pipelineDStatus = latest.pipeline_d ?? (pipelineDRow
        ? {
            pipeline: 'pipeline_d',
            status: pipelineDRow.status === 'failed' ? 'failed' : 'success',
            started_at: pipelineDRow.created_at,
            updated_at: pipelineDRow.updated_at,
            result_summary: 'Recent one-off drafts created',
          }
        : undefined);

      return {
        coordinator: formatPipelineStatus("coordinator", latest.coordinator),
        pipeline_a: formatPipelineStatus("pipeline_a", latest.pipeline_a),
        pipeline_b: formatPipelineStatus("pipeline_b", latest.pipeline_b),
        pipeline_c: formatPipelineStatus("pipeline_c", latest.pipeline_c),
        pipeline_d: formatPipelineStatus("pipeline_d", pipelineDStatus),
      };
    },
    ...options?.query,
  });
}
function formatPipelineStatus(key: string, row?: any) {
  return {
    pipeline: key,
    description: PIPELINE_DESCRIPTIONS[key],
    status: row?.status ?? "idle",
    last_run: row?.started_at ?? row?.created_at ?? null,
    duration: (() => {
      const seconds = row ? calculateDurationSeconds(row) : null;
      return seconds == null ? null : `${seconds}s`;
    })(),
  };
}

export function useListPipelineRuns(params: PipelineRunsFilter = {}, options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? ["pipeline-runs", getOrgId(), params],
    queryFn: async () => {
      let query = supabase
        .from("pipeline_runs")
        .select("*")
        .eq("org_id", getOrgId())
        .order("started_at", { ascending: false });

      if (params.limit) query = query.limit(params.limit);

      const [{ data, error }, { data: pipelineDRows, error: pipelineDError }] = await Promise.all([
        query,
        supabase
          .from("content_registry")
          .select("id, created_at, updated_at, status, created_by")
          .eq("org_id", getOrgId())
          .eq("created_by", "pipeline-d-post")
          .eq("is_campaign_post", false)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (error) throw error;
      if (pipelineDError) throw pipelineDError;

      const baseRuns = (data ?? []).map((row) => ({
        ...row,
        pipeline: toPipelineKey(row.pipeline),
        started_at: row.started_at ?? row.created_at,
        duration_seconds: calculateDurationSeconds(row),
        result_summary: summarizeRun(row),
        error_message: row.error_message ?? row.result?.error ?? null,
      }));

      const syntheticPipelineDRuns = (pipelineDRows ?? []).map((row) => ({
        id: `pipeline-d-${row.id}`,
        pipeline: 'pipeline_d',
        status: row.status === 'failed' ? 'failed' : 'success',
        started_at: row.created_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        duration_seconds: calculateDurationSeconds(row) ?? 0,
        result_summary: row.status === 'failed' ? 'One-off post failed' : 'Recent one-off drafts created',
        error_message: row.status === 'failed' ? 'One-off post failed' : null,
        result: null,
      }));

      const mergedRuns = [...syntheticPipelineDRuns, ...baseRuns]
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      return params.limit ? mergedRuns.slice(0, params.limit) : mergedRuns;
    },
    ...options?.query,
  });
}
export function useGetOrgConfig(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetOrgConfigQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase.from("org_config").select("*").eq("org_id", getOrgId()).single();
      if (error) throw error;
      return normalizeOrgConfig(data);
    },
    ...options?.query,
  });
}

export function useUpdateOrgConfig(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ data }: { data: Partial<OrgConfig> & Record<string, any> }) => {
      const { data: current, error: currentError } = await supabase
        .from("org_config")
        .select("*")
        .eq("org_id", getOrgId())
        .single();

      if (currentError) throw currentError;

      const patch: Record<string, any> = {};

      if ("org_name" in data) patch.org_name = data.org_name;
      if ("full_name" in data) patch.full_name = data.full_name;
      if ("country" in data) patch.country = data.country;
      if ("timezone" in data) patch.timezone = data.timezone;
      if ("contact_email" in data) patch.contact_email = data.contact_email;

      if (data.brand_voice) {
        patch.brand_voice = toStoredBrandVoice(data.brand_voice, current.brand_voice);
      }

      if (data.kpi_targets) {
        patch.kpi_targets = {
          ...(current.kpi_targets ?? {}),
          ...data.kpi_targets,
        };
      }

      if (data.pipeline_config) {
        patch.pipeline_config = toStoredPipelineConfig(data.pipeline_config);
      }

      if (data.platform_connections) {
        patch.platform_connections = data.platform_connections;
      }

      if (data.brand_visual !== undefined) {
        patch.brand_visual = data.brand_visual;
      }

      if (data.markdown_design_spec !== undefined) {
        patch.markdown_design_spec = data.markdown_design_spec;
      }

      if (data.social_handles !== undefined) {
        patch.social_handles = data.social_handles;
      }

      if (data.primary_cta_url !== undefined) {
        patch.primary_cta_url = data.primary_cta_url;
      }

      const { data: updated, error } = await supabase
        .from("org_config")
        .update(patch)
        .eq("org_id", getOrgId())
        .select("*")
        .single();

      if (error) throw error;
      return normalizeOrgConfig(updated);
    },
    ...options?.mutation,
  });
}

export function useListAmbassadors(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListAmbassadorsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_registry")
        .select("*")
        .eq("org_id", getOrgId())
        .order("weekly_reach", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    ...options?.query,
  });
}

export function useUpdateAmbassador(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { data: updated, error } = await supabase
        .from("ambassador_registry")
        .update(data)
        .eq("id", id)
        .eq("org_id", getOrgId())
        .select("*")
        .single();

      if (error) throw error;
      return updated;
    },
    ...options?.mutation,
  });
}

export function useDeleteAmbassador(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("ambassador_registry").delete().eq("id", id).eq("org_id", getOrgId());
      if (error) throw error;
      return { id };
    },
    ...options?.mutation,
  });
}

export function useCreateAmbassador(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ data }: { data: { name: string; university: string; weekly_reach: number } }) => {
      const payload = {
        ...data,
        org_id: getOrgId(),
        status: "active",
      };

      const { data: inserted, error } = await supabase
        .from("ambassador_registry")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      return inserted;
    },
    ...options?.mutation,
  });
}

export function useListCalendarEvents(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListCalendarEventsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_calendar")
        .select("*")
        .eq("org_id", getOrgId())
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    ...options?.query,
  });
}

export function useCreateCalendarEvent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({
      data,
    }: {
      data: { event_type: string; event_date: string; event_end_date?: string | null; label: string; universities: string[]; creative_override_allowed?: boolean };
    }) => {
      const payload = {
        ...data,
        event_end_date: data.event_end_date || null,
        creative_override_allowed: data.creative_override_allowed ?? false,
        org_id: getOrgId(),
        triggered: false,
        lead_days: 21,
        pipeline_trigger: "pipeline_c",
      };

      const { data: inserted, error } = await supabase
        .from("academic_calendar")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      return inserted;
    },
    ...options?.mutation,
  });
}

export function useUpdateCalendarEvent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ event_type: string; event_date: string; event_end_date?: string | null; label: string; universities: string[]; creative_override_allowed?: boolean }>;
    }) => {
      const { data: updated, error } = await supabase
        .from("academic_calendar")
        .update(data)
        .eq("id", id)
        .eq("org_id", getOrgId())
        .select("*")
        .single();
      if (error) throw error;
      return updated;
    },
    ...options?.mutation,
  });
}

export function useDeleteCalendarEvent(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("academic_calendar")
        .delete()
        .eq("id", id)
        .eq("org_id", getOrgId());
      if (error) throw error;
    },
    ...options?.mutation,
  });
}

export function useListMetrics(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? ["platform-metrics", getOrgId()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_metrics")
        .select("*")
        .eq("org_id", getOrgId())
        .order("snapshot_date", { ascending: false })
        .limit(40);

      if (error) throw error;

      const grouped = new Map<string, any[]>();
      for (const row of data ?? []) {
        const list = grouped.get(row.platform) ?? [];
        list.push(row);
        grouped.set(row.platform, list);
      }

      return PLATFORM_ORDER.map((platform) => {
        const rows = grouped.get(platform) ?? [];
        const latest = rows[0];
        const previous = rows[1];

        if (!latest) return null;

        const engagement = latest.engagement_rate ?? latest.engagement ?? 0;

        return {
          platform,
          followers: latest.followers ?? 0,
          post_reach: latest.post_reach ?? latest.reach ?? 0,
          engagement: engagement,
          signups: latest.signups ?? 0,
          followers_change:
            latest.followers_change ?? calculatePercentChange(latest.followers ?? 0, previous?.followers ?? 0),
          reach_change:
            latest.reach_change ?? calculatePercentChange(latest.post_reach ?? 0, previous?.post_reach ?? 0),
          engagement_change:
            latest.engagement_change ?? calculatePercentChange(engagement ?? 0, previous?.engagement_rate ?? previous?.engagement ?? 0),
          signups_change:
            latest.signups_change ?? calculatePercentChange(latest.signups ?? 0, previous?.signups ?? 0),
        };
      }).filter(Boolean);
    },
    ...options?.query,
  });
}

export function useGetMetricsSparklines(options?: QueryHookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? ["platform-metric-sparklines", getOrgId()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_metrics")
        .select("platform, signups, snapshot_date")
        .eq("org_id", getOrgId())
        .order("snapshot_date", { ascending: false })
        .limit(80);

      if (error) throw error;

      const result: Record<string, Array<{ value: number }>> = {
        facebook: [],
        whatsapp: [],
        youtube: [],
        email: [],
      };

      for (const platform of Object.keys(result)) {
        result[platform] = (data ?? [])
          .filter((row) => row.platform === platform)
          .slice(0, 7)
          .reverse()
          .map((row) => ({ value: row.signups ?? 0 }));
      }

      return result;
    },
    ...options?.query,
  });
}








type CoordinatorChatRequest = {
  message: string;
  history?: Array<{ role: "user" | "coordinator"; content: string }>;
  confirmationAction?: string | null;
};

type CoordinatorChatResponse = {
  message: string;
  suggestions?: string[];
  confirmation?: {
    title: string;
    description: string;
    action: string;
  } | null;
  invoked_action?: {
    type: "run_pipeline";
    pipeline: string;
    status: "queued" | "completed" | "failed";
  } | null;
};

export function useCoordinatorChat(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ message, history = [], confirmationAction = null }: CoordinatorChatRequest) => {
      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          throw new Error("Your session expired. Please sign in again.");
        }

        const { data, error } = await supabase.functions.invoke("coordinator-chat", {
          body: {
            message,
            history,
            confirmationAction,
            orgId: getOrgId(),
          },
          headers: accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : undefined,
        });

        if (error) {
          throw error;
        }

        return (data ?? {}) as CoordinatorChatResponse;
      } catch (error) {
        const message = await readFunctionError(error);
        throw new Error(message);
      }
    },
    ...options?.mutation,
  });
}

export function useTriggerPipeline(options?: MutationHookOptions) {
  return useMutation({
    mutationFn: async ({ pipeline }: { pipeline: "a" | "b" | "c" }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Your session expired. Please sign in again.");

      const messageMap = {
        a: "run pipeline a",
        b: "run pipeline b",
        c: "run pipeline c",
      };

      const { error } = await supabase.functions.invoke("coordinator-chat", {
        body: {
          message: messageMap[pipeline],
          history: [],
          confirmationAction: null,
          orgId: getOrgId(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw error;
    },
    ...options?.mutation,
  });
}

