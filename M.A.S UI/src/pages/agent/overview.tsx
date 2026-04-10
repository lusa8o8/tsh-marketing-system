import React, { useState } from "react";
import { useGetPipelinesStatus, useListPipelineRuns, useTriggerPipeline } from "@/lib/api";
import { Clock, Activity, ChevronRight, ChevronDown, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PIPELINE_TRIGGER_KEY: Record<string, "a" | "b" | "c"> = {
  pipeline_a: "a",
  pipeline_b: "b",
  pipeline_c: "c",
};

export default function AgentOverview() {
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useGetPipelinesStatus();
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useListPipelineRuns({ limit: 20 });
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [triggeringPipeline, setTriggeringPipeline] = useState<string | null>(null);
  const triggerPipeline = useTriggerPipeline();
  const { toast } = useToast();

  const statusCards = statusData ? [
    { key: "coordinator", data: statusData.coordinator },
    { key: "pipeline_a", data: statusData.pipeline_a },
    { key: "pipeline_b", data: statusData.pipeline_b },
    { key: "pipeline_c", data: statusData.pipeline_c },
  ] : [];

  async function handleTrigger(pipelineKey: string) {
    const triggerKey = PIPELINE_TRIGGER_KEY[pipelineKey];
    if (!triggerKey) return;

    setTriggeringPipeline(pipelineKey);
    try {
      await triggerPipeline.mutateAsync({ pipeline: triggerKey });
      toast({ title: "Pipeline triggered", description: `${pipelineKey.replace(/_/g, " ")} run queued.` });
      setTimeout(() => { refetchStatus(); refetchRuns(); }, 2000);
    } catch (err) {
      toast({ title: "Trigger failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTriggeringPipeline(null);
    }
  }

  function formatResultSummary(run: any): string | null {
    if (!run.result) return null;
    const r = run.result;
    const parts: string[] = [];
    if (r.comments_processed != null) parts.push(`${r.comments_processed} comments`);
    if (r.replies_sent != null) parts.push(`${r.replies_sent} replies`);
    if (r.escalations != null && r.escalations > 0) parts.push(`${r.escalations} escalations`);
    if (r.boosts_suggested != null && r.boosts_suggested > 0) parts.push(`${r.boosts_suggested} boosts`);
    if (r.spam_ignored != null && r.spam_ignored > 0) parts.push(`${r.spam_ignored} spam`);
    if (r.posts_drafted != null) parts.push(`${r.posts_drafted} drafts`);
    if (r.copy_assets_created != null) parts.push(`${r.copy_assets_created} copy assets`);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>Operations</span>
            <span>/</span>
            <span className="text-foreground">Overview</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">System activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline health, recent runs, and operational visibility across the workspace.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/10 px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground/80">
              <Activity className="h-4 w-4" />
              System Status
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statusLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-lg" />
                ))
              ) : (
                statusCards.map(({ key, data }) => {
                  const canTrigger = key !== "coordinator";
                  const isTriggering = triggeringPipeline === key;
                  const isBlocked = data.status === "running" || data.status === "resumed" || data.status === "waiting_human";

                  return (
                    <div key={key} className={cn(
                      "relative overflow-hidden rounded-lg border bg-card p-5 shadow-sm",
                      data.status === "failed" && "border-red-300 shadow-red-100"
                    )}>
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold capitalize">{data.pipeline.replace(/_/g, " ")}</h3>
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{data.description}</p>
                        </div>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                          {(data.status === "running" || data.status === "resumed") && <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
                          {data.status === "success" && <span className="h-2.5 w-2.5 rounded-full bg-green-500" />}
                          {data.status === "waiting_human" && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
                          {data.status === "cancelled" && <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />}
                          {data.status === "failed" && <span className="h-2.5 w-2.5 rounded-full bg-red-500" />}
                          {data.status === "idle" && <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />}
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5 border-t pt-4 text-[12px] text-muted-foreground/80">
                        <div className="flex justify-between">
                          <span>Last run</span>
                          <span className="font-medium text-foreground/80">{data.last_run ? new Date(data.last_run).toLocaleTimeString() : "Never"}</span>
                        </div>
                        {data.duration && (
                          <div className="flex justify-between">
                            <span>Duration</span>
                            <span>{data.duration}</span>
                          </div>
                        )}
                      </div>

                      {canTrigger && (
                        <div className="mt-3 border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-full gap-1.5 text-xs"
                            disabled={isTriggering || isBlocked}
                            onClick={() => handleTrigger(key)}
                          >
                            <Play className="h-3 w-3" />
                            {isTriggering ? "Starting…" : isBlocked ? data.status.replace(/_/g, " ") : "Run now"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground/80">
              <Clock className="h-4 w-4" />
              Recent Executions
            </h2>
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : runs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No recent runs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs?.map((run) => {
                      const resultSummary = formatResultSummary(run);
                      return (
                        <React.Fragment key={run.id}>
                          <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}>
                            <TableCell className="p-2 text-muted-foreground">
                              {expandedRun === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="text-sm font-medium capitalize">{run.pipeline.replace(/_/g, " ")}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 text-[10px] capitalize",
                                  run.status === "success" && "border-green-200 bg-green-100 text-green-800",
                                  (run.status === "running" || run.status === "resumed") && "border-blue-200 bg-blue-100 text-blue-800",
                                  run.status === "waiting_human" && "border-amber-200 bg-amber-100 text-amber-800",
                                  run.status === "cancelled" && "border-gray-200 bg-gray-100 text-gray-700",
                                  run.status === "failed" && "border-red-200 bg-red-100 text-red-700"
                                )}
                              >
                                {run.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{run.duration_seconds ? `${run.duration_seconds}s` : "—"}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-sm">
                              {run.status === "failed" ? (
                                <span className="text-red-600">{run.error_message}</span>
                              ) : resultSummary ? (
                                <span className="text-muted-foreground">{resultSummary}</span>
                              ) : (
                                <span className="text-muted-foreground/50">{run.result_summary || "—"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedRun === run.id && run.result && (
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={6} className="border-b p-0">
                                <div className="p-4 pl-12">
                                  <pre className="overflow-x-auto rounded-md border bg-background p-4 font-mono text-[11px] text-foreground/80 shadow-inner">
                                    {JSON.stringify(run.result, null, 2)}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
