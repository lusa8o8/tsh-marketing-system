import { useState, useEffect, useRef } from "react";
import { useGetOrgConfig, useUpdateOrgConfig, useTriggerPipeline, getGetOrgConfigQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Building, MessageSquare, Share2, GitBranch, Target, Check, AlertCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SiFacebook, SiWhatsapp, SiYoutube, SiLinkedin, SiTiktok, SiSlack, SiTelegram } from "react-icons/si";
import { Mail, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INTEGRATIONS = [
  { id: "facebook",  name: "Facebook Pages",            Icon: SiFacebook,  color: "#1877F2", live: true },
  { id: "whatsapp",  name: "WhatsApp Business",         Icon: SiWhatsapp,  color: "#25D366", live: true },
  { id: "youtube",   name: "YouTube Channel",           Icon: SiYoutube,   color: "#FF0000", live: true },
  { id: "email",     name: "Email (SendGrid)",           Icon: Mail,        color: "#000",    live: true },
  { id: "studyhub",  name: "StudyHub App",              Icon: Building,    color: "#000",    live: true },
  { id: "linkedin",  name: "LinkedIn Page",             Icon: SiLinkedin,  color: "#0A66C2", live: false },
  { id: "tiktok",    name: "TikTok Account",            Icon: SiTiktok,    color: "#010101", live: false },
  { id: "slack",     name: "Slack Workspace",           Icon: SiSlack,     color: "#4A154B", live: false },
  { id: "teams",     name: "Microsoft Teams",           Icon: Monitor,     color: "#6264A7", live: false },
  { id: "telegram",  name: "Telegram Channel",          Icon: SiTelegram,  color: "#26A5E4", live: false },
];

export default function AgentSettings() {
  const { data: config, isLoading } = useGetOrgConfig();
  const updateMutation = useUpdateOrgConfig();
  const triggerPipeline = useTriggerPipeline();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [orgData, setOrgData] = useState<any>({});
  const [brandData, setBrandData] = useState<any>({});
  const [kpiData, setKpiData] = useState<any>({});
  const [pipelineData, setPipelineData] = useState<any>({});

  const initialized = useRef(false);

  useEffect(() => {
    if (config && !initialized.current) {
      setOrgData({
        org_name: config.org_name,
        full_name: config.full_name,
        country: config.country,
        timezone: config.timezone,
        contact_email: config.contact_email
      });
      setBrandData(config.brand_voice);
      setKpiData(config.kpi_targets);
      setPipelineData(config.pipeline_config);
      initialized.current = true;
    }
  }, [config]);

  const [triggeringPipeline, setTriggeringPipeline] = useState<string | null>(null);

  async function handleTriggerPipeline(pipeline: "a" | "b" | "c", label: string) {
    setTriggeringPipeline(pipeline);
    try {
      await triggerPipeline.mutateAsync({ pipeline });
      toast({ title: "Pipeline triggered", description: `${label} run queued.` });
    } catch (err) {
      toast({ title: "Trigger failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTriggeringPipeline(null);
    }
  }

  function handleToggleConnection(platformId: string, currentlyConnected: boolean) {
    const updated = { ...config.platform_connections };
    if (currentlyConnected) {
      delete updated[platformId];
    } else {
      updated[platformId] = { connected: true, connected_at: new Date().toISOString() };
    }
    updateMutation.mutate(
      { data: { platform_connections: updated } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrgConfigQueryKey() });
          toast({
            title: currentlyConnected ? "Integration disabled" : "Integration enabled",
            description: `${platformId} connection ${currentlyConnected ? "removed" : "saved"}.`,
          });
        },
      }
    );
  }

  const handleSave = (sectionKey: string, data: any) => {
    const payload = { [sectionKey]: data };
    if (sectionKey === "org") {
      Object.assign(payload, data);
      delete payload.org;
    }

    updateMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrgConfigQueryKey() });
          toast({
            title: "Settings saved",
            description: "Configuration has been updated successfully.",
          });
        }
      }
    );
  };

  if (isLoading || !initialized.current) {
    return <div className="space-y-4 p-8"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const TagInput = ({ value, onChange }: { value: string[], onChange: (v: string[]) => void }) => {
    const [input, setInput] = useState("");
    return (
      <div className="space-y-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((tag, i) => (
            <Badge key={i} variant="secondary" className="flex items-center gap-1 bg-muted">
              {tag}
              <span className="ml-1 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>�</span>
            </Badge>
          ))}
        </div>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              onChange([...value, input.trim()]);
              setInput("");
            }
          }}
          placeholder="Type and press enter..."
          className="h-9 text-sm"
        />
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>Operations</span>
            <span>/</span>
            <span className="text-foreground">Settings</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Operational settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage workspace configuration, brand voice, publishing connections, and automation rules.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-4xl">
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
            <AccordionItem value="item-1" className="overflow-hidden rounded-lg border bg-card px-2 shadow-sm">
              <AccordionTrigger className="px-4 py-5 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2 text-foreground/70"><Building className="h-4 w-4" /></div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">Organisation Details</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Basic profile and contact information</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Short Name</Label>
                    <Input value={orgData.org_name} onChange={(e) => setOrgData({ ...orgData, org_name: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Full Legal Name</Label>
                    <Input value={orgData.full_name} onChange={(e) => setOrgData({ ...orgData, full_name: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Country</Label>
                    <Input value={orgData.country} onChange={(e) => setOrgData({ ...orgData, country: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Timezone</Label>
                    <Input value={orgData.timezone} onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs">Contact Email</Label>
                    <Input value={orgData.contact_email} onChange={(e) => setOrgData({ ...orgData, contact_email: e.target.value })} className="h-9" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave("org", orgData)} disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Save Organisation
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="overflow-hidden rounded-lg border bg-card px-2 shadow-sm">
              <AccordionTrigger className="px-4 py-5 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2 text-foreground/70"><MessageSquare className="h-4 w-4" /></div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">Brand Voice</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Instructions for the AI copywriter</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Tone & Personality</Label>
                      <Textarea value={brandData.tone} onChange={(e) => setBrandData({ ...brandData, tone: e.target.value })} className="h-24 resize-none text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Target Audience</Label>
                      <Textarea value={brandData.target_audience} onChange={(e) => setBrandData({ ...brandData, target_audience: e.target.value })} className="h-24 resize-none text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Always Say (Keywords)</Label>
                      <TagInput value={brandData.always_say || []} onChange={(v) => setBrandData({ ...brandData, always_say: v })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Never Say (Banned Words)</Label>
                      <TagInput value={brandData.never_say || []} onChange={(v) => setBrandData({ ...brandData, never_say: v })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Preferred Call-to-Action</Label>
                    <Input value={brandData.preferred_cta} onChange={(e) => setBrandData({ ...brandData, preferred_cta: e.target.value })} className="h-9" />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-xs font-semibold text-green-700"><Check className="h-3 w-3" /> Good Post Example</Label>
                      <Textarea value={brandData.good_post_example} onChange={(e) => setBrandData({ ...brandData, good_post_example: e.target.value })} className="h-32 resize-none border-l-4 border-l-green-500 bg-green-50/30 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-xs font-semibold text-red-700"><AlertCircle className="h-3 w-3" /> Bad Post Example</Label>
                      <Textarea value={brandData.bad_post_example} onChange={(e) => setBrandData({ ...brandData, bad_post_example: e.target.value })} className="h-32 resize-none border-l-4 border-l-red-500 bg-red-50/30 text-sm" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave("brand_voice", brandData)} disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Save Brand Voice
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="overflow-hidden rounded-lg border bg-card px-2 shadow-sm">
              <AccordionTrigger className="px-4 py-5 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2 text-foreground/70"><Share2 className="h-4 w-4" /></div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">Integrations & Platforms</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Manage connected publishing accounts</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="mb-4 flex items-center justify-center rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                  API credentials are managed securely in the backend and never displayed here.
                </div>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Active channels</div>
                <div className="mb-5 space-y-2">
                  {INTEGRATIONS.filter((p) => p.live).map(({ id, name, Icon, color }) => {
                    const isConnected = !!config.platform_connections[id];
                    return (
                      <div key={id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                        <div className="flex items-center gap-3">
                          <Icon style={{ color }} className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-medium">{name}</span>
                          {isConnected ? (
                            <Badge variant="outline" className="h-5 border-green-200 bg-green-50 px-1.5 text-[10px] text-green-700">Connected</Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">Not connected</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={isConnected}
                            disabled={updateMutation.isPending}
                            onCheckedChange={() => handleToggleConnection(id, isConnected)}
                          />
                          <Button
                            size="sm"
                            variant={isConnected ? "outline" : "default"}
                            className="h-8 w-28 text-xs"
                            disabled={updateMutation.isPending}
                            onClick={() => handleToggleConnection(id, isConnected)}
                          >
                            {isConnected ? "Disconnect" : "Connect"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Coming soon</div>
                <div className="space-y-2">
                  {INTEGRATIONS.filter((p) => !p.live).map(({ id, name, Icon, color }) => (
                    <div key={id} className="flex items-center justify-between rounded-lg border border-dashed bg-muted/20 p-3 opacity-60">
                      <div className="flex items-center gap-3">
                        <Icon style={{ color }} className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">{name}</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">Coming soon</Badge>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 w-28 text-xs" disabled>Connect</Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="overflow-hidden rounded-lg border bg-card px-2 shadow-sm">
              <AccordionTrigger className="px-4 py-5 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2 text-foreground/70"><GitBranch className="h-4 w-4" /></div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">Pipeline Automation</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Configure scheduled AI jobs</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="space-y-6">
                  <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Engagement Pipeline</h4>
                        <p className="text-xs text-muted-foreground">Scans comments and flags escalations</p>
                      </div>
                      <Switch checked={pipelineData.pipeline_a_enabled} onCheckedChange={(v) => setPipelineData({ ...pipelineData, pipeline_a_enabled: v })} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-xs">Run time (Daily)</Label>
                      <Input type="time" value={pipelineData.pipeline_a_run_time} onChange={(e) => setPipelineData({ ...pipelineData, pipeline_a_run_time: e.target.value })} className="h-8 w-32 text-xs" disabled={!pipelineData.pipeline_a_enabled} />
                      <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5 text-xs" disabled={triggeringPipeline === "a" || !pipelineData.pipeline_a_enabled} onClick={() => handleTriggerPipeline("a", "Engagement pipeline")}>
                        <Play className="h-3 w-3" />{triggeringPipeline === "a" ? "Starting…" : "Run now"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Content Drafting Pipeline</h4>
                        <p className="text-xs text-muted-foreground">Generates weekly social posts for approval</p>
                      </div>
                      <Switch checked={pipelineData.pipeline_b_enabled} onCheckedChange={(v) => setPipelineData({ ...pipelineData, pipeline_b_enabled: v })} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-xs">Run day</Label>
                      <select className="h-8 w-32 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm" value={pipelineData.pipeline_b_run_day} onChange={(e) => setPipelineData({ ...pipelineData, pipeline_b_run_day: e.target.value })} disabled={!pipelineData.pipeline_b_enabled}>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                      <Input type="time" value={pipelineData.pipeline_b_run_time} onChange={(e) => setPipelineData({ ...pipelineData, pipeline_b_run_time: e.target.value })} className="h-8 w-32 text-xs" disabled={!pipelineData.pipeline_b_enabled} />
                      <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5 text-xs" disabled={triggeringPipeline === "b" || !pipelineData.pipeline_b_enabled} onClick={() => handleTriggerPipeline("b", "Content drafting pipeline")}>
                        <Play className="h-3 w-3" />{triggeringPipeline === "b" ? "Starting…" : "Run now"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Campaign Builder Pipeline</h4>
                        <p className="text-xs text-muted-foreground">End-to-end campaign creation</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={triggeringPipeline === "c" || !pipelineData.pipeline_c_enabled} onClick={() => handleTriggerPipeline("c", "Campaign builder pipeline")}>
                          <Play className="h-3 w-3" />{triggeringPipeline === "c" ? "Starting…" : "Run now"}
                        </Button>
                        <Switch checked={pipelineData.pipeline_c_enabled} onCheckedChange={(v) => setPipelineData({ ...pipelineData, pipeline_c_enabled: v })} />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50/50 p-3">
                      <Switch checked={pipelineData.pipeline_c_auto_approve} onCheckedChange={(v) => setPipelineData({ ...pipelineData, pipeline_c_auto_approve: v })} disabled={!pipelineData.pipeline_c_enabled} />
                      <div>
                        <Label className="text-xs font-semibold text-amber-800">Auto-approve briefs</Label>
                        <p className="mt-0.5 text-[11px] leading-snug text-amber-700/80">
                          Enabling this skips manual approval for campaign briefs. The agent will proceed directly to drafting content.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave("pipeline_config", pipelineData)} disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Save Pipelines
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="overflow-hidden rounded-lg border bg-card px-2 shadow-sm">
              <AccordionTrigger className="px-4 py-5 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2 text-foreground/70"><Target className="h-4 w-4" /></div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold">KPI Targets</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Goals for the agent to optimize towards</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                  {[
                    { key: "weekly_signups", label: "Weekly Signups" },
                    { key: "youtube_weekly_growth", label: "YouTube Growth (%)" },
                    { key: "whatsapp_reach_per_post", label: "WhatsApp Reach/Post" },
                    { key: "facebook_reach_per_post", label: "Facebook Reach/Post" },
                    { key: "email_open_rate", label: "Email Open Rate (%)" },
                    { key: "active_ambassadors", label: "Active Ambassadors" }
                  ].map((field) => (
                    <div key={field.key} className="flex items-center justify-between border-b border-muted p-3">
                      <Label className="text-xs">{field.label}</Label>
                      <Input type="number" value={kpiData[field.key]} onChange={(e) => setKpiData({ ...kpiData, [field.key]: Number(e.target.value) })} className="h-8 w-24 text-right text-sm font-medium" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave("kpi_targets", kpiData)} disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Save Targets
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
