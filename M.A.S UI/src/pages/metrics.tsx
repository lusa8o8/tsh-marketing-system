import { SiFacebook, SiWhatsapp, SiYoutube } from "react-icons/si";
import { Mail, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "facebook", name: "Facebook", icon: SiFacebook, color: "text-[#1877F2]" },
  { id: "whatsapp", name: "WhatsApp", icon: SiWhatsapp, color: "text-[#25D366]" },
  { id: "youtube", name: "YouTube", icon: SiYoutube, color: "text-[#FF0000]" },
  { id: "email", name: "Email Newsletter", icon: Mail, color: "text-gray-700" },
];

export default function Metrics() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Platform Metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly reach, engagement, and sign-up movement across every active channel.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/10 px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-border bg-muted/40 p-3 text-foreground">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Live metrics are not connected yet</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    This workspace is no longer showing seeded placeholder analytics. Platform metrics will appear here once
                    real ingestion is connected for each channel.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => (
                    <div
                      key={platform.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    >
                      <platform.icon className={cn("h-4 w-4", platform.color)} />
                      <span>{platform.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <EmptyMetricPanel
              title="What will show up here"
              items={[
                "Followers or subscribers by connected channel",
                "Reach and engagement snapshots over time",
                "Sign-up movement tied to active campaigns",
              ]}
            />
            <EmptyMetricPanel
              title="What needs to happen first"
              items={[
                "Connect a live metrics ingestion path for each platform",
                "Store real org-scoped snapshots instead of placeholders",
                "Re-enable charts after live analytics are flowing",
              ]}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyMetricPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground/70">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground/50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
