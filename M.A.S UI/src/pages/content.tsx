import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  useListContent,
  useRetryContent,
  useActionContent,
  useBatchApproveContent,
  useEditContent,
  useUploadContentImage,
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
  Pencil,
  Share2,
  ImagePlus,
  Paintbrush,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  design_brief: "Design Brief",
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
                className={cn("h-3.5 w-3.5", PLATFORM_COLORS[p])}
                title={PLATFORM_LABELS[p] || p}
              />
            );
          })}
        </div>
        <span className="text-sm font-medium text-muted-foreground">Cross-platform</span>
      </div>
    );
  }

  const Icon = PLATFORM_ICONS[platform] || Clock;
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", PLATFORM_COLORS[platform])} />
      <span className="text-sm font-medium capitalize">{PLATFORM_LABELS[platform] || platform}</span>
    </div>
  );
}

function getContentType(item: { platform: string; subject_line?: string | null }) {
  if (item.subject_line) return { label: "Email", icon: Mail };
  return { label: "Text post", icon: FileText };
}

interface ContentCardProps {
  item: ContentItem;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: (id: string) => void;
  onApprove: (id: string, pipelineRunId?: string | null, platform?: string) => void;
  onReject: (id: string, pipelineRunId?: string | null, note?: string) => void;
  onEdit: (id: string, body: string, subjectLine?: string | null) => void;
  onImageUpload: (id: string, file: File) => void;
  retryPending: boolean;
  actionPending: boolean;
  editPending: boolean;
  imagePending: boolean;
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
  onEdit,
  onImageUpload,
  retryPending,
  actionPending,
  editPending,
  imagePending,
}: ContentCardProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(item.body);
  const [editSubjectLine, setEditSubjectLine] = useState(item.subject_line ?? "");

  const isFailed = item.status === "failed";
  const isDraft = item.status === "draft";
  const isRejected = item.status === "rejected";
  const contentType = getContentType(item);
  const TypeIcon = contentType.icon;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200",
        isFailed ? "border-red-200" : isDraft ? "border-blue-200/60" : "border-border",
        isExpanded ? "col-span-full shadow-sm" : "cursor-pointer hover:border-foreground/20 hover:shadow-sm"
      )}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className={cn("flex items-start justify-between gap-4 p-5", isExpanded && "cursor-pointer")} onClick={isExpanded ? onToggle : undefined}>
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformDisplay platform={item.platform} platforms={item.platforms} />
              <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                <TypeIcon className="h-3 w-3" />
                {contentType.label}
              </span>
            </div>
            {item.subject_line && <p className="mt-0.5 truncate text-sm font-medium">{item.subject_line}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "border-0 text-[10px] font-medium capitalize",
              item.status === "published" && "bg-green-100 text-green-800",
              item.status === "scheduled" && "bg-blue-50 text-blue-700",
              item.status === "failed" && "bg-red-100 text-red-700",
              item.status === "draft" && "bg-amber-50 text-amber-700",
              item.status === "rejected" && "bg-orange-100 text-orange-700"
            )}
          >
            {item.status}
          </Badge>
          <button className="p-0.5 text-muted-foreground transition-colors hover:text-foreground" aria-label={isExpanded ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className="-mt-2 px-5 pb-4">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{stripMarkdownToPreviewText(item.body)}</p>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 border-t border-dashed px-5 pb-5 pt-4">
          {isEditing ? (
            <div className="space-y-3">
              {item.subject_line !== null && item.subject_line !== undefined && (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Subject line</p>
                  <Input
                    value={editSubjectLine}
                    onChange={(e) => setEditSubjectLine(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Body</p>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[120px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={editPending}
                  onClick={() => {
                    onEdit(item.id, editBody, item.subject_line !== undefined ? editSubjectLine || null : undefined);
                    setIsEditing(false);
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditBody(item.body); setEditSubjectLine(item.subject_line ?? ""); setIsEditing(false); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4">
              <MarkdownBody content={item.body} />
            </div>
          )}

          {!isEditing && item.platforms && item.platforms.length > 1 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                {item.platforms.map((p) => {
                  const Icon = PLATFORM_ICONS[p] || Clock;
                  return <Icon key={p} className={cn("h-3 w-3", PLATFORM_COLORS[p])} />;
                })}
              </div>
              <span>
                This post will be published identically to: {item.platforms.map((p) => PLATFORM_LABELS[p] || p).join(" & ")}
              </span>
            </div>
          )}

          {!isEditing && (
            <div className="space-y-2">
              {item.media_url && (
                <div className="overflow-hidden rounded-md border">
                  <img src={item.media_url} alt="Attached media" className="h-40 w-full object-cover" />
                </div>
              )}
              <label className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted",
                imagePending && "cursor-not-allowed opacity-50"
              )}>
                <ImagePlus className="h-3.5 w-3.5" />
                {imagePending ? "Uploading…" : item.media_url ? "Replace image" : "Add image"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={imagePending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImageUpload(item.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <div className={cn("flex items-center justify-between px-5 pb-4", isExpanded && "border-t pt-3")}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
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
          {(isDraft || isRejected) && !isEditing && !showRejectInput && (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setIsEditing(true); if (!isExpanded) onToggle(); }} disabled={actionPending}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {isRejected ? "Edit & resubmit" : "Edit"}
              </Button>
              {isDraft && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRejectInput(true)} disabled={actionPending}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button size="sm" className="h-7 bg-green-600 text-xs text-white hover:bg-green-700" onClick={() => onApprove(item.id, item.pipeline_run_id, item.platform)} disabled={actionPending}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Approve
                  </Button>
                </>
              )}
            </>
          )}

          {isDraft && showRejectInput && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Input
                placeholder="Reason for rejection..."
                className="h-8 min-w-[160px] flex-1 text-xs"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onReject(item.id, item.pipeline_run_id, rejectReason); setShowRejectInput(false); setRejectReason(""); }
                  if (e.key === "Escape") setShowRejectInput(false);
                }}
              />
              <Button size="sm" variant="destructive" className="h-8 shrink-0 px-3 text-xs" onClick={() => { onReject(item.id, item.pipeline_run_id, rejectReason); setShowRejectInput(false); setRejectReason(""); }} disabled={actionPending}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-8 shrink-0 px-2" onClick={() => setShowRejectInput(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isFailed && (
            <Button size="sm" variant="outline" className="h-7 border-red-200 text-xs text-red-700 hover:bg-red-50" onClick={() => onRetry(item.id)} disabled={retryPending}>
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", retryPending && "animate-spin")} />
              Retry
            </Button>
          )}
        </div>
      </div>

      {isFailed && item.error_message && (
        <div className="mx-5 mb-4 flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-[11px] text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{item.error_message}</span>
        </div>
      )}
    </div>
  );
}

function DesignBriefCard({
  item,
  isExpanded,
  onToggle,
  onApprove,
  onEdit,
  actionPending,
  editPending,
}: {
  item: ContentItem;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: (id: string, pipelineRunId?: string | null, platform?: string) => void;
  onEdit: (id: string, body: string) => void;
  actionPending: boolean;
  editPending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(item.body);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDraft = item.status === "draft";
  const shareText = `Design Brief — ${item.campaign_name ?? "Campaign"}\n\n${item.body}`;
  const encodedText = encodeURIComponent(shareText);
  const encodedSubject = encodeURIComponent(`Design Brief — ${item.campaign_name ?? "Campaign"}`);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setShowShareMenu(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedText}` },
    { label: "Telegram", href: `https://t.me/share/url?url=&text=${encodedText}` },
    { label: "Email", href: `mailto:?subject=${encodedSubject}&body=${encodedText}` },
  ];

  return (
    <div
      className={cn(
        "col-span-full rounded-xl border bg-card transition-all duration-200",
        "border-violet-200/60",
        isExpanded ? "shadow-sm" : "cursor-pointer hover:border-foreground/20 hover:shadow-sm"
      )}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className={cn("flex items-start justify-between gap-4 p-5", isExpanded && "cursor-pointer")} onClick={isExpanded ? onToggle : undefined}>
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium text-violet-700">Design Brief</span>
          {item.campaign_name && (
            <span className="text-[11px] text-muted-foreground">· {item.campaign_name}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="border-0 text-[10px] font-medium capitalize bg-violet-50 text-violet-700">
            {item.status}
          </Badge>
          <button className="p-0.5 text-muted-foreground transition-colors hover:text-foreground" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className="-mt-2 px-5 pb-4">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{stripMarkdownToPreviewText(item.body)}</p>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 border-t border-dashed px-5 pb-5 pt-4">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Brief</p>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[140px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" disabled={editPending} onClick={() => { onEdit(item.id, editBody); setIsEditing(false); }}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditBody(item.body); setIsEditing(false); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4">
              <MarkdownBody content={item.body} />
            </div>
          )}
        </div>
      )}

      {isDraft && isExpanded && (
        <div className="flex items-center justify-end gap-2 border-t px-5 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
          {!isEditing && (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setIsEditing(true); if (!isExpanded) onToggle(); }} disabled={actionPending}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>

              <div className="relative">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowShareMenu((v) => !v)}>
                  <Share2 className="mr-1 h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Share"}
                </Button>
                {showShareMenu && (
                  <div className="absolute bottom-full right-0 z-10 mb-1 min-w-[160px] rounded-lg border bg-background py-1 shadow-md">
                    {shareOptions.map((opt) => (
                      <a
                        key={opt.label}
                        href={opt.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-3 py-2 text-xs hover:bg-muted"
                        onClick={() => setShowShareMenu(false)}
                      >
                        {opt.label}
                      </a>
                    ))}
                    <button className="flex w-full items-center px-3 py-2 text-xs hover:bg-muted" onClick={handleCopy}>
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>

              <Button size="sm" className="h-7 bg-green-600 text-xs text-white hover:bg-green-700" onClick={() => onApprove(item.id, item.pipeline_run_id, item.platform)} disabled={actionPending}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}
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

type ContentItem = {
  id: string;
  platform: string;
  platforms?: string[] | null;
  body: string;
  subject_line?: string | null;
  status: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  error_message?: string | null;
  campaign_name?: string | null;
  pipeline_run_id?: string | null;
  media_url?: string | null;
  rejection_note?: string | null;
};

function groupDraftsByCampaign(items: ContentItem[]) {
  const groups: { pipeline_run_id: string; campaign_name: string; items: ContentItem[] }[] = [];
  const ungrouped: ContentItem[] = [];

  for (const item of items) {
    if (item.pipeline_run_id && item.campaign_name) {
      const existing = groups.find((g) => g.pipeline_run_id === item.pipeline_run_id);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ pipeline_run_id: item.pipeline_run_id, campaign_name: item.campaign_name, items: [item] });
      }
    } else {
      ungrouped.push(item);
    }
  }

  return { groups, ungrouped };
}

export default function Content() {
  const [status, setStatus] = useState<TabStatus>("draft");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["content-registry"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-items"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-summary"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-status"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] });
  };

  const { data: items, isLoading } = useListContent({ status }, {
    query: { queryKey: getListContentQueryKey({ status }) }
  });

  const retryMutation = useRetryContent({ mutation: { onSuccess: invalidate } });
  const actionMutation = useActionContent({
    mutation: { onSuccess: () => { invalidate(); setExpandedId(null); } }
  });
  const batchApproveMutation = useBatchApproveContent({ mutation: { onSuccess: invalidate } });
  const editMutation = useEditContent({ mutation: { onSuccess: invalidate } });
  const imageMutation = useUploadContentImage({ mutation: { onSuccess: invalidate } });

  const handleToggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  const handleApprove = (id: string, pipelineRunId?: string | null, platform?: string) =>
    actionMutation.mutate({ id, pipelineRunId, platform, data: { action: "approve" } });
  const handleReject = (id: string, pipelineRunId?: string | null, note?: string) =>
    actionMutation.mutate({ id, pipelineRunId, data: { action: "reject", note } });
  const handleEdit = (id: string, body: string, subjectLine?: string | null) =>
    editMutation.mutate({ id, body, subjectLine });
  const handleImageUpload = (id: string, file: File) =>
    imageMutation.mutate({ id, file });

  const renderCard = (item: ContentItem) => {
    if (item.platform === "design_brief") {
      return (
        <DesignBriefCard
          key={item.id}
          item={item}
          isExpanded={expandedId === item.id}
          onToggle={() => handleToggle(item.id)}
          onApprove={handleApprove}
          onEdit={(id, body) => handleEdit(id, body)}
          actionPending={actionMutation.isPending}
          editPending={editMutation.isPending}
        />
      );
    }
    return (
      <ContentCard
        key={item.id}
        item={item}
        isExpanded={expandedId === item.id}
        onToggle={() => handleToggle(item.id)}
        onRetry={(id) => retryMutation.mutate({ id })}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={handleEdit}
        onImageUpload={handleImageUpload}
        retryPending={retryMutation.isPending}
        actionPending={actionMutation.isPending}
        editPending={editMutation.isPending}
        imagePending={imageMutation.isPending}
      />
    );
  };

  // Design briefs only appear in the Drafts tab — filter them from all other tabs
  const displayItems = status !== "draft"
    ? (items ?? []).filter((i: ContentItem) => i.platform !== "design_brief")
    : (items ?? []);

  const { groups, ungrouped } = status === "draft" && displayItems.length > 0
    ? groupDraftsByCampaign(displayItems as ContentItem[])
    : { groups: [], ungrouped: displayItems as ContentItem[] };

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Content Registry</h1>
            <p className="mt-1 text-sm text-muted-foreground">Drafts, scheduled posts, and published assets flowing through the workspace.</p>
          </div>
          <Button size="sm">New Post</Button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border/80 bg-background/70 px-4 md:px-6">
        <div className="flex gap-6 overflow-x-auto text-sm font-medium">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatus(tab.id); setExpandedId(null); }}
              className={cn(
                "border-b-2 py-3 transition-colors",
                status === tab.id
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
        <div className="mx-auto max-w-4xl space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : (groups.length === 0 && ungrouped.length === 0 && displayItems.length === 0) ? (
            <div className="py-20 text-center text-muted-foreground">
              <LayoutList className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No {status} content found.</p>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.pipeline_run_id}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Campaign</p>
                      <h2 className="text-sm font-semibold text-foreground">{group.campaign_name}</h2>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={batchApproveMutation.isPending}
                      onClick={() => batchApproveMutation.mutate({ pipelineRunId: group.pipeline_run_id })}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Approve all ({group.items.filter((i) => i.status === "draft" && i.platform !== "design_brief").length})
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {group.items.map(renderCard)}
                  </div>
                </div>
              ))}

              {ungrouped.length > 0 && (
                <div>
                  {groups.length > 0 && (
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Other drafts</p>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {ungrouped.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
