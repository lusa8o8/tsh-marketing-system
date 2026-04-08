import { useListMetrics, useGetMetricsSparklines } from "@/lib/api";
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
  const { data: sparklines } = useGetMetricsSparklines();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Platform Metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Weekly reach, engagement, and sign-up movement across every active channel.</p>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/10 px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-6xl space-y-8">
          {PLATFORMS.map((platform) => {
            const metric = metrics?.find((m) => m.platform === platform.id);
            const sparklineData = sparklines?.[platform.id as keyof typeof sparklines] || [];

            return (
              <section key={platform.id} className="space-y-4">
                <div className="flex items-center gap-2">
                  <platform.icon className={cn("h-5 w-5", platform.color)} />
                  <h2 className="font-semibold text-foreground">{platform.name}</h2>
                </div>

                {metricsLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-5">
                        <Skeleton className="mb-3 h-4 w-24" />
                        <Skeleton className="mb-2 h-8 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : metric ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard title="Followers / Subscribers" value={metric.followers} change={metric.followers_change} />
                    <MetricCard title="Weekly Reach" value={metric.post_reach} change={metric.reach_change} />
                    <MetricCard title="Engagement Rate" value={metric.engagement} change={metric.engagement_change} format="percent" />
                    <MetricCard title="New Sign-ups" value={metric.signups} change={metric.signups_change} sparklineData={sparklineData} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="mb-1 text-[13px] font-medium text-muted-foreground">{title}</h3>
        <div className="text-2xl font-bold tracking-tight">{displayValue}</div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className={cn(
          "flex items-center gap-1 text-[12px] font-medium",
          isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
        )}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : isNegative ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          <span>{displayChange}</span>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-8 w-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
