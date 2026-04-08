import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  useListContent,
  useRetryContent,
  useActionContent,
  getListContentQueryKey,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { SiFacebook, SiWhatsapp, SiYoutube } from "react-icons/si";
import {
  Mail,
  Clock,
  AlertCircle,
  RefreshCw,
  LayoutList,
  ChevronDown,
  ChevronUp,
  FileText,
  Images,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, stripMarkdownToPreviewText } from "@/lib/utils";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: SiFacebook,
  whatsapp: SiWhatsapp,
  youtube: SiYoutube,
  email: Mail,
  studyhub: Clock,
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "text-[#1877F2]",
  whatsapp: "text-[#25D366]",
  youtube: "text-[#FF0000]",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  email: "Email",
  studyhub: "StudyHub",
};

function PlatformDisplay({ platform, platforms }: { platform: string; platforms?: string[] | null }) {
  const isCross = platforms && platforms.length > 1;

  if (isCross) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {platforms.map((p) => {
            const Icon = PLATFORM_ICONS[p] || Clock;
            return (
              <Icon
                key={p}
                className={cn("w-3.5 h-3.5", PLATFORM_COLORS[p])}
                title={PLATFORM_LABELS[p] || p}
              />
            );
          })}
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          Cross-platform
        </span>
      </div>
    );
  }

  const Icon = PLATFORM_ICONS[platform] || Clock;
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("w-4 h-4", PLATFORM_COLORS[platform])} />
      <span className="text-sm font-medium capitalize">
        {PLATFORM_LABELS[platform] || platform}
      </span>
    </div>
  );
}

function getContentType(item: { platform: string; subject_line?: string | null }) {
  if (item.subject_line) return { label: "Email", icon: Mail };
  return { label: "Text post", icon: FileText };
}

interface ContentCardProps {
  item: {
    id: string;
    platform: string;
    platforms?: string[] | null;
    body: string;
    subject_line?: string | null;
    status: string;
    scheduled_at?: string | null;
    published_at?: string | null;
    error_message?: string | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  retryPending: boolean;
  actionPending: boolean;
}

function MarkdownBody({ content }: { content?: string | null }) {
  if (!content) return null;

  return (
    <div className="prose prose-sm max-w-none text-[13px] leading-relaxed prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-foreground prose-code:text-foreground">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function ContentCard({
  item,
  isExpanded,
  onToggle,
  onRetry,
  onApprove,
  onReject,
  retryPending,
  actionPending,
}: ContentCardProps) {
  const isFailed = item.status === "failed";
  const isDraft = item.status === "draft";
  const contentType = getContentType(item);
  const TypeIcon = contentType.icon;

  return (
    <div
      className={cn(
        "border rounded-lg bg-card transition-all duration-200",
        isFailed ? "border-red-200" : isDraft ? "border-blue-200/60" : "border-border",
        isExpanded ? "col-span-full shadow-sm" : "hover:border-foreground/20 hover:shadow-sm cursor-pointer"
      )}
      onClick={!isExpanded ? onToggle : undefined}
    >
      {/* Card header */}
      <div
        className={cn("flex items-start justify-between gap-4 p-5", isExpanded && "cursor-pointer")}
        onClick={isExpanded ? onToggle : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PlatformDisplay platform={item.platform} platforms={item.platforms} />
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground border rounded-full px-2 py-0.5">
                <TypeIcon className="w-3 h-3" />
                {contentType.label}
              </span>
            </div>
            {item.subject_line && (
              <p className="text-sm font-medium mt-0.5 truncate">{item.subject_line}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={cn(
              "capitalize font-medium text-[10px] border-0",
              item.status === "published" && "bg-green-100 text-green-800",
              item.status === "scheduled" && "bg-blue-50 text-blue-700",
              item.status === "failed" && "bg-red-100 text-red-700",
              item.status === "draft" && "bg-amber-50 text-amber-700"
            )}
          >
            {item.status}
          </Badge>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body preview — collapsed */}
      {!isExpanded && (
        <div className="px-5 pb-4 -mt-2">
          <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
            {stripMarkdownToPreviewText(item.body)}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-dashed pt-4 space-y-4">
          <div className="bg-muted/40 rounded-lg p-4 border">
            <MarkdownBody content={stripMarkdownToPreviewText(item.body)} />
          </div>

          {/* Cross-platform note */}
          {item.platforms && item.platforms.length > 1 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                {item.platforms.map((p) => {
                  const Icon = PLATFORM_ICONS[p] || Clock;
                  return <Icon key={p} className={cn("w-3 h-3", PLATFORM_COLORS[p])} />;
                })}
              </div>
              <span>
                This post will be published identically to: {item.platforms.map(p => PLATFORM_LABELS[p] || p).join(" & ")}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Images className="w-3.5 h-3.5" />
            <span>No attachments — graphics &amp; carousels will appear here</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={cn("px-5 pb-4 flex items-center justify-between", isExpanded && "border-t pt-3")}>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {item.status === "scheduled" && item.scheduled_at ? (
            <span>Scheduled: {new Date(item.scheduled_at).toLocaleDateString()}</span>
          ) : item.status === "published" && item.published_at ? (
            <span>Published: {new Date(item.published_at).toLocaleDateString()}</span>
          ) : item.status === "draft" ? (
            <span>Awaiting approval</span>
          ) : (
            <span>No date set</span>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isDraft && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onReject(item.id)}
                disabled={actionPending}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove(item.id)}
                disabled={actionPending}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Approve
              </Button>
            </>
          )}

          {isFailed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onRetry(item.id)}
              disabled={retryPending}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", retryPending && "animate-spin")} />
              Retry
            </Button>
          )}
        </div>
      </div>

      {isFailed && item.error_message && (
        <div className="mx-5 mb-4 text-[11px] text-red-600 bg-red-50 p-2 rounded-md flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{item.error_message}</span>
        </div>
      )}
    </div>
  );
}

type TabStatus = "draft" | "scheduled" | "published" | "failed";

const TABS: { id: TabStatus; label: string }[] = [
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "failed", label: "Failed" },
];

export default function Content() {
  const [status, setStatus] = useState<TabStatus>("draft");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useListContent({ status }, {
    query: { queryKey: getListContentQueryKey({ status }) }
  });

  const retryMutation = useRetryContent({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListContentQueryKey() })
    }
  });

  const actionMutation = useActionContent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
        setExpandedId(null);
      }
    }
  });

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleApprove = (id: string) => {
    actionMutation.mutate({ id, data: { action: "approve" } });
  };

  const handleReject = (id: string) => {
    actionMutation.mutate({ id, data: { action: "reject" } });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-background">
        <h1 className="font-semibold text-lg">Content Registry</h1>
        <Button size="sm">New Post</Button>
      </header>

      <div className="border-b px-6 flex gap-6 text-sm font-medium shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setStatus(tab.id); setExpandedId(null); }}
            className={cn(
              "py-3 border-b-2 transition-colors",
              status === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-5 bg-card space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          ) : items?.length === 0 ? (
            <div className="col-span-full text-center py-20 text-muted-foreground">
              <LayoutList className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No {status} content found.</p>
            </div>
          ) : (
            items?.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => handleToggle(item.id)}
                onRetry={(id) => retryMutation.mutate({ id })}
                onApprove={handleApprove}
                onReject={handleReject}
                retryPending={retryMutation.isPending}
                actionPending={actionMutation.isPending}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}






