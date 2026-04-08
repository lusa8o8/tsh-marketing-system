import { useState } from "react";
import { useListInboxItems, useActionInboxItem, getGetInboxSummaryQueryKey, getListInboxItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 md:px-6 flex items-center shrink-0 bg-background">
        <h1 className="font-semibold text-lg">Inbox</h1>
      </header>

      <div className="border-b px-4 md:px-6 flex gap-5 text-sm font-medium shrink-0 overflow-x-auto">
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
              "py-3 border-b-2 transition-colors whitespace-nowrap",
              filter === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : items?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>You're all caught up!</p>
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
        "border rounded-lg bg-card overflow-hidden transition-all duration-200 shadow-sm",
        isUrgent ? "border-red-200" : "border-border",
        !isPending && "opacity-60"
      )}
    >
      {/* ── Clickable header ── */}
      <div
        className={cn(
          "p-4 cursor-pointer hover:bg-muted/50 transition-colors select-none",
          expanded && "bg-muted/30"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Row 1: badge + status + chevron */}
        <div className="flex items-center gap-2 mb-2">
          {/* Urgency dot */}
          {isPending && (
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isUrgent ? "bg-red-500 animate-pulse" : "bg-blue-500"
              )}
            />
          )}

          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-medium shrink-0",
              BADGE_COLORS[item.item_type]
            )}
          >
            {BADGE_LABELS[item.item_type] || item.item_type.replace(/_/g, " ")}
          </Badge>

          {!isPending && (
            <Badge
              variant="secondary"
              className="text-[10px] uppercase h-5 px-1.5 bg-green-100 text-green-800 border-green-200"
            >
              {item.status}
            </Badge>
          )}

          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground/50 ml-auto shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>

        {/* Row 2: title */}
        <h3 className="font-semibold text-[14px] leading-snug mb-1 pr-2">
          {item.payload.title || item.item_type}
        </h3>

        {/* Row 3: preview */}
        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
          {item.payload.preview || item.payload.post_copy || "No preview available"}
        </p>

        {/* Row 4: meta */}
        <div className="text-[11px] text-muted-foreground/60 mt-2 flex items-center gap-1.5 flex-wrap">
          {item.payload.pipeline && (
            <>
              <span>{item.payload.pipeline}</span>
              <span>·</span>
            </>
          )}
          <span>{formatDistanceToNow(new Date(item.created_at))} ago</span>
        </div>
      </div>

      {/* ── Action row (outside click area so buttons don't toggle expand) ── */}
      {isPending && (
        <div
          className="px-4 pb-4 flex items-center gap-2 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {hasActions && !showRejectInput && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShowRejectInput(true)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleAction("approve")}
                disabled={actionMutation.isPending}
              >
                Approve
              </Button>
            </>
          )}

          {hasActions && showRejectInput && (
            <div className="flex items-center gap-2 w-full flex-wrap">
              <Input
                placeholder="Reason for rejection..."
                className="h-8 text-xs flex-1 min-w-[160px]"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rejectReason) handleAction("reject", rejectReason);
                  else if (e.key === "Escape") setShowRejectInput(false);
                }}
              />
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-3 text-xs shrink-0"
                onClick={() => handleAction("reject", rejectReason)}
                disabled={!rejectReason || actionMutation.isPending}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 shrink-0"
                onClick={() => setShowRejectInput(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {isFyi && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => handleAction("read")}
              disabled={actionMutation.isPending}
            >
              Mark read
            </Button>
          )}
        </div>
      )}

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t bg-muted/10 text-[13px] space-y-4">
          {item.item_type === "campaign_brief" && (
            <dl className="grid grid-cols-[auto_1fr] gap-y-3 gap-x-4">
              {Object.entries(item.payload).map(([key, value]) => {
                if (key === "title" || key === "preview") return null;
                return (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground font-medium capitalize whitespace-nowrap">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-foreground break-words">{String(value)}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {(item.item_type === "weekly_report" ||
            item.item_type === "campaign_report" ||
            item.item_type === "suggestion") && (
            <div className="text-[13px] leading-relaxed text-foreground">
              {item.payload.body}
            </div>
          )}

          {item.item_type === "escalation" && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-md">
                <p className="text-xs font-medium text-red-800 mb-1">
                  Original Comment ({item.payload.platform})
                </p>
                <p className="text-sm italic">"{item.payload.original_comment}"</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Response</p>
                <div className="p-3 bg-card border rounded-md text-sm">
                  {item.payload.suggested_response}
                </div>
              </div>
            </div>
          )}

          {item.item_type === "ambassador_flag" && (
            <div className="text-[13px] text-foreground leading-relaxed">
              {item.payload.body || item.payload.preview}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
