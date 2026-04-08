import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetPipelinesStatus, useListPipelineRuns } from "@/lib/api";
import { Play, CheckCircle2, XCircle, Clock, Activity, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AgentOverview() {
  const { data: statusData, isLoading: statusLoading } = useGetPipelinesStatus();
  const { data: runs, isLoading: runsLoading } = useListPipelineRuns({ limit: 10 });
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const statusCards = statusData ? [
    { key: 'coordinator', data: statusData.coordinator },
    { key: 'pipeline_a', data: statusData.pipeline_a },
    { key: 'pipeline_b', data: statusData.pipeline_b },
    { key: 'pipeline_c', data: statusData.pipeline_c },
  ] : [];

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center shrink-0 bg-background">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Agent Manager</span>
          <span className="text-muted-foreground">/</span>
          <span>Overview</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <section>
            <h2 className="text-sm font-semibold mb-4 text-foreground/80 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statusLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))
              ) : (
                statusCards.map(({ key, data }) => (
                  <div key={key} className={cn(
                    "bg-card border rounded-lg p-5 shadow-sm relative overflow-hidden",
                    data.status === 'failed' && "border-red-300 shadow-sm shadow-red-100"
                  )}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm capitalize">{data.pipeline.replace(/_/g, ' ')}</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{data.description}</p>
                      </div>
                      <div className="shrink-0 flex items-center justify-center w-6 h-6">
                        {data.status === 'running' && <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />}
                        {data.status === 'success' && <span className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                        {data.status === 'failed' && <span className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                        {data.status === 'idle' && <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t text-[12px] text-muted-foreground/80 space-y-1.5">
                      <div className="flex justify-between">
                        <span>Last run</span>
                        <span className="font-medium text-foreground/80">{data.last_run ? new Date(data.last_run).toLocaleTimeString() : 'Never'}</span>
                      </div>
                      {data.duration && (
                        <div className="flex justify-between">
                          <span>Duration</span>
                          <span>{data.duration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-4 text-foreground/80 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Executions
            </h2>
            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
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
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No recent runs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs?.map(run => (
                      <React.Fragment key={run.id}>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                        >
                          <TableCell className="p-2 text-muted-foreground">
                            {expandedRun === run.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="font-medium capitalize text-sm">{run.pipeline.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Badge variant={
                              run.status === 'success' ? 'default' : 
                              run.status === 'failed' ? 'destructive' : 
                              run.status === 'running' ? 'secondary' : 'outline'
                            } className={cn(
                              "capitalize text-[10px] h-5",
                              run.status === 'success' && "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
                              run.status === 'running' && "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"
                            )}>
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(run.started_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {run.duration_seconds ? `${run.duration_seconds}s` : '-'}
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">
                            {run.status === 'failed' ? (
                              <span className="text-red-600">{run.error_message}</span>
                            ) : (
                              <span className="text-muted-foreground">{run.result_summary || '-'}</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedRun === run.id && run.result && (
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={6} className="p-0 border-b">
                              <div className="p-4 pl-12">
                                <pre className="text-[11px] font-mono bg-background border rounded-md p-4 overflow-x-auto text-foreground/80 shadow-inner">
                                  {JSON.stringify(run.result, null, 2)}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
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
