import { useListMetrics, useGetMetricsSparklines } from "@workspace/api-client-react";
import { SiFacebook, SiWhatsapp, SiYoutube } from "react-icons/si";
import { Mail, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

const PLATFORMS = [
  { id: "facebook", name: "Facebook", icon: SiFacebook, color: "text-[#1877F2]" },
  { id: "whatsapp", name: "WhatsApp", icon: SiWhatsapp, color: "text-[#25D366]" },
  { id: "youtube", name: "YouTube", icon: SiYoutube, color: "text-[#FF0000]" },
  { id: "email", name: "Email Newsletter", icon: Mail, color: "text-gray-700" }
];

export default function Metrics() {
  const { data: metrics, isLoading: metricsLoading } = useListMetrics();
  const { data: sparklines, isLoading: sparklinesLoading } = useGetMetricsSparklines();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-background z-10">
        <h1 className="font-semibold text-lg">Platform Metrics</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
        <div className="max-w-6xl mx-auto space-y-8">
          {PLATFORMS.map(platform => {
            const metric = metrics?.find(m => m.platform === platform.id);
            const sparklineData = sparklines?.[platform.id as keyof typeof sparklines] || [];
            
            return (
              <section key={platform.id} className="space-y-4">
                <div className="flex items-center gap-2">
                  <platform.icon className={cn("w-5 h-5", platform.color)} />
                  <h2 className="font-semibold">{platform.name}</h2>
                </div>
                
                {metricsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-card border rounded-lg p-5">
                        <Skeleton className="h-4 w-24 mb-3" />
                        <Skeleton className="h-8 w-20 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : metric ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard 
                      title="Followers / Subscribers" 
                      value={metric.followers} 
                      change={metric.followers_change} 
                    />
                    <MetricCard 
                      title="Weekly Reach" 
                      value={metric.post_reach} 
                      change={metric.reach_change} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={metric.engagement} 
                      change={metric.engagement_change}
                      format="percent"
                    />
                    <MetricCard 
                      title="New Sign-ups" 
                      value={metric.signups} 
                      change={metric.signups_change}
                      sparklineData={sparklineData}
                    />
                  </div>
                ) : (
                  <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">
                    No data available for {platform.name}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  change, 
  format = "number",
  sparklineData
}: { 
  title: string; 
  value: number; 
  change?: number; 
  format?: "number" | "percent";
  sparklineData?: any[];
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  
  const displayValue = format === "percent" ? `${value.toFixed(1)}%` : value.toLocaleString();
  const displayChange = change ? `${Math.abs(change).toFixed(1)}%` : "0%";

  return (
    <div className="bg-card border rounded-lg p-5 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-[13px] font-medium text-muted-foreground mb-1">{title}</h3>
        <div className="text-2xl font-bold tracking-tight">{displayValue}</div>
      </div>
      
      <div className="mt-4 flex items-end justify-between">
        <div className={cn(
          "flex items-center gap-1 text-[12px] font-medium",
          isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
        )}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : isNegative ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          <span>{displayChange}</span>
        </div>
        
        {sparklineData && sparklineData.length > 0 && (
          <div className="h-8 w-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-primary)" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}