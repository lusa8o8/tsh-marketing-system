import { useState, useEffect, useRef } from "react";
import { useGetOrgConfig, useUpdateOrgConfig, getGetOrgConfigQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Building, MessageSquare, Share2, GitBranch, Target, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SiFacebook, SiWhatsapp, SiYoutube } from "react-icons/si";
import { Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function AgentSettings() {
  const { data: config, isLoading } = useGetOrgConfig();
  const updateMutation = useUpdateOrgConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Local state for forms
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

  const handleSave = (sectionKey: string, data: any) => {
    const payload = { [sectionKey]: data };
    // If it's org fields, spread them at root
    if (sectionKey === 'org') {
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
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const TagInput = ({ value, onChange }: { value: string[], onChange: (v: string[]) => void }) => {
    const [input, setInput] = useState("");
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag, i) => (
            <Badge key={i} variant="secondary" className="flex items-center gap-1 bg-muted">
              {tag}
              <span className="cursor-pointer text-muted-foreground hover:text-foreground ml-1" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</span>
            </Badge>
          ))}
        </div>
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
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
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 border-b px-6 flex items-center shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Agent Manager</span>
          <span className="text-muted-foreground">/</span>
          <span>Settings</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
            
            {/* ORGANISATION */}
            <AccordionItem value="item-1" className="border rounded-lg bg-card px-2 overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-foreground/70"><Building className="w-4 h-4" /></div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm">Organisation Details</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Basic profile and contact information</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Short Name</Label>
                    <Input value={orgData.org_name} onChange={e => setOrgData({...orgData, org_name: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Full Legal Name</Label>
                    <Input value={orgData.full_name} onChange={e => setOrgData({...orgData, full_name: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Country</Label>
                    <Input value={orgData.country} onChange={e => setOrgData({...orgData, country: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Timezone</Label>
                    <Input value={orgData.timezone} onChange={e => setOrgData({...orgData, timezone: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs">Contact Email</Label>
                    <Input value={orgData.contact_email} onChange={e => setOrgData({...orgData, contact_email: e.target.value})} className="h-9" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave('org', orgData)} disabled={updateMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" /> Save Organisation
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BRAND VOICE */}
            <AccordionItem value="item-2" className="border rounded-lg bg-card px-2 overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-foreground/70"><MessageSquare className="w-4 h-4" /></div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm">Brand Voice</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Instructions for the AI copywriter</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-xs">Tone & Personality</Label>
                      <Textarea value={brandData.tone} onChange={e => setBrandData({...brandData, tone: e.target.value})} className="h-24 resize-none text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Target Audience</Label>
                      <Textarea value={brandData.target_audience} onChange={e => setBrandData({...brandData, target_audience: e.target.value})} className="h-24 resize-none text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Always Say (Keywords)</Label>
                      <TagInput value={brandData.always_say || []} onChange={v => setBrandData({...brandData, always_say: v})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Never Say (Banned Words)</Label>
                      <TagInput value={brandData.never_say || []} onChange={v => setBrandData({...brandData, never_say: v})} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Preferred Call-to-Action</Label>
                    <Input value={brandData.preferred_cta} onChange={e => setBrandData({...brandData, preferred_cta: e.target.value})} className="h-9" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-green-700 font-semibold flex items-center gap-1"><Check className="w-3 h-3"/> Good Post Example</Label>
                      <Textarea value={brandData.good_post_example} onChange={e => setBrandData({...brandData, good_post_example: e.target.value})} className="h-32 resize-none text-sm border-l-4 border-l-green-500 bg-green-50/30" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-red-700 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Bad Post Example</Label>
                      <Textarea value={brandData.bad_post_example} onChange={e => setBrandData({...brandData, bad_post_example: e.target.value})} className="h-32 resize-none text-sm border-l-4 border-l-red-500 bg-red-50/30" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave('brand_voice', brandData)} disabled={updateMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" /> Save Brand Voice
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PLATFORMS */}
            <AccordionItem value="item-3" className="border rounded-lg bg-card px-2 overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-foreground/70"><Share2 className="w-4 h-4" /></div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm">Integrations & Platforms</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage connected publishing accounts</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="bg-muted/30 border border-dashed rounded-md p-3 mb-6 text-xs text-muted-foreground flex items-center justify-center">
                  API credentials are managed securely in the backend and never displayed here.
                </div>
                
                <div className="space-y-3">
                  {[
                    { id: 'facebook', name: 'Facebook Pages', icon: SiFacebook, color: '#1877F2' },
                    { id: 'whatsapp', name: 'WhatsApp Business', icon: SiWhatsapp, color: '#25D366' },
                    { id: 'youtube', name: 'YouTube Channel', icon: SiYoutube, color: '#FF0000' },
                    { id: 'email', name: 'Email Provider (SendGrid)', icon: Mail, color: '#000' },
                    { id: 'studyhub', name: 'StudyHub App', icon: Building, color: '#000' }
                  ].map(platform => {
                    const isConnected = !!config.platform_connections[platform.id];
                    return (
                      <div key={platform.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                        <div className="flex items-center gap-3">
                          <platform.icon style={{ color: platform.color }} className="w-5 h-5" />
                          <span className="font-medium text-sm">{platform.name}</span>
                          {isConnected ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-5 px-1.5 text-[10px]">Connected</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground h-5 px-1.5 text-[10px]">Not Connected</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch checked={isConnected} disabled />
                          <Button size="sm" variant={isConnected ? "outline" : "default"} className="h-8 text-xs w-24">
                            {isConnected ? 'Re-auth' : 'Connect'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PIPELINES */}
            <AccordionItem value="item-4" className="border rounded-lg bg-card px-2 overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-foreground/70"><GitBranch className="w-4 h-4" /></div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm">Pipeline Automation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Configure scheduled AI jobs</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="space-y-6">
                  {/* Pipeline A */}
                  <div className="p-4 border rounded-lg space-y-4 bg-background">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">Engagement Pipeline</h4>
                        <p className="text-xs text-muted-foreground">Scans comments and flags escalations</p>
                      </div>
                      <Switch 
                        checked={pipelineData.pipeline_a_enabled} 
                        onCheckedChange={v => setPipelineData({...pipelineData, pipeline_a_enabled: v})}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs w-24">Run time (Daily)</Label>
                      <Input 
                        type="time" 
                        value={pipelineData.pipeline_a_run_time} 
                        onChange={e => setPipelineData({...pipelineData, pipeline_a_run_time: e.target.value})}
                        className="w-32 h-8 text-xs" 
                        disabled={!pipelineData.pipeline_a_enabled}
                      />
                    </div>
                  </div>

                  {/* Pipeline B */}
                  <div className="p-4 border rounded-lg space-y-4 bg-background">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">Content Drafting Pipeline</h4>
                        <p className="text-xs text-muted-foreground">Generates weekly social posts for approval</p>
                      </div>
                      <Switch 
                        checked={pipelineData.pipeline_b_enabled} 
                        onCheckedChange={v => setPipelineData({...pipelineData, pipeline_b_enabled: v})}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs w-24">Run day</Label>
                      <select 
                        className="flex h-8 w-32 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                        value={pipelineData.pipeline_b_run_day}
                        onChange={e => setPipelineData({...pipelineData, pipeline_b_run_day: e.target.value})}
                        disabled={!pipelineData.pipeline_b_enabled}
                      >
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                      <Input 
                        type="time" 
                        value={pipelineData.pipeline_b_run_time} 
                        onChange={e => setPipelineData({...pipelineData, pipeline_b_run_time: e.target.value})}
                        className="w-32 h-8 text-xs" 
                        disabled={!pipelineData.pipeline_b_enabled}
                      />
                    </div>
                  </div>

                  {/* Pipeline C */}
                  <div className="p-4 border rounded-lg space-y-4 bg-background">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">Campaign Builder Pipeline</h4>
                        <p className="text-xs text-muted-foreground">End-to-end campaign creation</p>
                      </div>
                      <Switch 
                        checked={pipelineData.pipeline_c_enabled} 
                        onCheckedChange={v => setPipelineData({...pipelineData, pipeline_c_enabled: v})}
                      />
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-md">
                      <Switch 
                        checked={pipelineData.pipeline_c_auto_approve} 
                        onCheckedChange={v => setPipelineData({...pipelineData, pipeline_c_auto_approve: v})}
                        disabled={!pipelineData.pipeline_c_enabled}
                      />
                      <div>
                        <Label className="text-xs font-semibold text-amber-800">Auto-approve briefs</Label>
                        <p className="text-[11px] text-amber-700/80 mt-0.5 leading-snug">
                          Enabling this skips manual approval for campaign briefs. The agent will proceed directly to drafting content.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave('pipeline_config', pipelineData)} disabled={updateMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" /> Save Pipelines
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* KPIs */}
            <AccordionItem value="item-5" className="border rounded-lg bg-card px-2 overflow-hidden shadow-sm">
              <AccordionTrigger className="hover:no-underline px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-foreground/70"><Target className="w-4 h-4" /></div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm">KPI Targets</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Goals for the agent to optimize towards</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { key: 'weekly_signups', label: 'Weekly Signups' },
                    { key: 'youtube_weekly_growth', label: 'YouTube Growth (%)' },
                    { key: 'whatsapp_reach_per_post', label: 'WhatsApp Reach/Post' },
                    { key: 'facebook_reach_per_post', label: 'Facebook Reach/Post' },
                    { key: 'email_open_rate', label: 'Email Open Rate (%)' },
                    { key: 'active_ambassadors', label: 'Active Ambassadors' }
                  ].map(field => (
                    <div key={field.key} className="flex items-center justify-between p-3 border-b border-muted">
                      <Label className="text-xs">{field.label}</Label>
                      <Input 
                        type="number" 
                        value={kpiData[field.key]} 
                        onChange={e => setKpiData({...kpiData, [field.key]: Number(e.target.value)})}
                        className="w-24 h-8 text-right text-sm font-medium" 
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button size="sm" onClick={() => handleSave('kpi_targets', kpiData)} disabled={updateMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" /> Save Targets
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
