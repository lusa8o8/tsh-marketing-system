import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useListInboxItems, useActionInboxItem, getGetInboxSummaryQueryKey, getListInboxItemsQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn, stripMarkdownToPreviewText } from "@/lib/utils";

const BADGE_COLORS: Record<string, string> = {
  draft_approval: "bg-blue-100 text-blue-800 border-blue-200",
  campaign_brief: "bg-purple-100 text-purple-800 border-purple-200",
  escalation: "bg-red-100 text-red-800 border-red-200",
  weekly_report: "bg-gray-100 text-gray-800 border-gray-200",
  campaign_report: "bg-gray-100 text-gray-800 border-gray-200",
  ambassador_flag: "bg-amber-100 text-amber-800 border-amber-200",
  suggestion: "bg-gray-100 text-gray-800 border-gray-200",
};

const BADGE_LABELS: Record<string, string> = {
  campaign_brief: "Campaign Brief",
  escalation: "Escalation",
  weekly_report: "Weekly Report",
  campaign_report: "Campaign Report",
  ambassador_flag: "Ambassador Flag",
  suggestion: "Suggestion",
};

function MarkdownBody({ content }: { content?: string | null }) {
  if (!content) return null;

  return (
    <div className="prose prose-sm max-w-none text-[13px] leading-relaxed prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-foreground prose-code:text-foreground">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default function Inbox() {
  const [filter, setFilter] = useState<"all" | "urgent" | "pending" | "fyi">("all");

  const queryParams =
    filter === "all" ? {} :
    filter === "urgent" ? { priority: "urgent" as const } :
    filter === "pending" ? { status: "pending" as const } :
    { priority: "fyi" as const };

  const { data: items, isLoading } = useListInboxItems(queryParams, {
    query: { queryKey: getListInboxItemsQueryKey(queryParams) }
  });

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approvals, escalations, and reports routed through your workspace.</p>
      </header>

      <div className="shrink-0 border-b border-border/80 bg-background/70 px-4 md:px-6">
        <div className="flex gap-5 overflow-x-auto text-sm font-medium">
          {[
            { id: "all", label: "All" },
            { id: "urgent", label: "Urgent" },
            { id: "pending", label: "Pending" },
            { id: "fyi", label: "FYI" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={cn(
                "whitespace-nowrap border-b-2 py-3 transition-colors",
                filter === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : items?.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <Check className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>You&apos;re all caught up.</p>
            </div>
          ) : (
            items
              ?.filter((item) => item.item_type !== "draft_approval")
              .map((item) => <InboxItemCard key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

function InboxItemCard({ item }: { item: any }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const queryClient = useQueryClient();

  const actionMutation = useActionInboxItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInboxItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInboxSummaryQueryKey() });
        setShowRejectInput(false);
      },
    },
  });

  const handleAction = (action: "approve" | "reject" | "read", note?: string) => {
    actionMutation.mutate({ id: item.id, data: { action, note } });
  };

  const isPending = item.status === "pending";
  const isUrgent = item.priority === "urgent";
  const isFyi = item.priority === "fyi";
  const hasActions = isPending && !isFyi;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200",
        isUrgent ? "border-red-200" : "border-border",
        !isPending && "opacity-60"
      )}
    >
      <div
        className={cn(
          "cursor-pointer select-none p-4 transition-colors hover:bg-muted/40",
          expanded && "bg-muted/25"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mb-2 flex items-center gap-2">
          {isPending && (
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                isUrgent ? "bg-red-500 animate-pulse" : "bg-blue-500"
              )}
            />
          )}

          <Badge variant="outline" className={cn("shrink-0 text-[11px] font-medium", BADGE_COLORS[item.item_type])}>
            {BADGE_LABELS[item.item_type] || item.item_type.replace(/_/g, " ")}
          </Badge>

          {!isPending && (
            <Badge variant="secondary" className="h-5 border-green-200 bg-green-100 px-1.5 text-[10px] uppercase text-green-800">
              {item.status}
            </Badge>
          )}

          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>

        <h3 className="mb-1 pr-2 text-[14px] font-semibold leading-snug">{item.payload.title || item.item_type}</h3>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {stripMarkdownToPreviewText(item.payload.preview || item.payload.post_copy) || "No preview available"}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/60">
          {item.payload.pipeline && (
            <>
              <span>{item.payload.pipeline}</span>
              <span>·</span>
            </>
          )}
          <span>{formatDistanceToNow(new Date(item.created_at))} ago</span>
        </div>
      </div>

      {isPending && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {hasActions && !showRejectInput && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowRejectInput(true)}>
                Reject
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => handleAction("approve")} disabled={actionMutation.isPending}>
                Approve
              </Button>
            </>
          )}

          {hasActions && showRejectInput && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Input
                placeholder="Reason for rejection..."
                className="h-8 min-w-[160px] flex-1 text-xs"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rejectReason) handleAction("reject", rejectReason);
                  else if (e.key === "Escape") setShowRejectInput(false);
                }}
              />
              <Button size="sm" variant="destructive" className="h-8 shrink-0 px-3 text-xs" onClick={() => handleAction("reject", rejectReason)} disabled={!rejectReason || actionMutation.isPending}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-8 shrink-0 px-2" onClick={() => setShowRejectInput(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isFyi && (
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handleAction("read")} disabled={actionMutation.isPending}>
              Mark read
            </Button>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-4 border-t bg-muted/10 px-4 pb-4 pt-3 text-[13px]">
          {item.item_type === "campaign_brief" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              {Object.entries(item.payload).map(([key, value]) => {
                if (key === "title" || key === "preview") return null;
                return (
                  <div key={key} className="contents">
                    <dt className="whitespace-nowrap font-medium capitalize text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                    <dd className="break-words text-foreground">{String(value)}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {(item.item_type === "weekly_report" || item.item_type === "campaign_report" || item.item_type === "suggestion") && (
            <MarkdownBody content={item.payload.body || item.payload.report || ""} />
          )}

          {item.item_type === "escalation" && (
            <div className="space-y-3">
              <div className="rounded-md border border-red-100 bg-red-50/50 p-3">
                <p className="mb-1 text-xs font-medium text-red-800">Original Comment ({item.payload.platform})</p>
                <p className="text-sm italic">&quot;{item.payload.original_comment}&quot;</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Suggested Response</p>
                <div className="rounded-md border bg-card p-3 text-sm">
                  <MarkdownBody content={item.payload.suggested_response || ""} />
                </div>
              </div>
            </div>
          )}

          {item.item_type === "ambassador_flag" && <MarkdownBody content={item.payload.body || item.payload.preview || ""} />}
        </div>
      )}
    </div>
  );
}
