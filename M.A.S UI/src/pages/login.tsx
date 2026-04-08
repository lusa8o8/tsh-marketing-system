import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  BriefcaseBusiness,
  ClipboardCheck,
  LockKeyhole,
  Mail,
  MonitorCog,
  TrendingUp,
  Users2,
} from "lucide-react";
import founderReviewImage from "@/assets/login/founder-review.jpg";
import leanTeamImage from "@/assets/login/lean-team.jpg";
import operatorMonitorImage from "@/assets/login/operator-monitor.jpg";
import ownerWorkflowImage from "@/assets/login/owner-workflow.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/supabase";

const audienceTiles = [
  {
    title: "Founders",
    description: "Review performance with less noise and more clarity.",
    icon: TrendingUp,
    image: founderReviewImage,
  },
  {
    title: "Lean teams",
    description: "Keep approvals, planning, and execution aligned.",
    icon: Users2,
    image: leanTeamImage,
  },
  {
    title: "Operators",
    description: "Monitor the work, route decisions, and stay in control.",
    icon: MonitorCog,
    image: operatorMonitorImage,
  },
  {
    title: "Owners",
    description: "Reduce marketing chaos without carrying every task yourself.",
    icon: BriefcaseBusiness,
    image: ownerWorkflowImage,
  },
] as const;

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("ops@tsh.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    setLocation("/inbox");
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(116,152,214,0.15),transparent_30%),linear-gradient(180deg,#f6f4ef_0%,#f4f2ec_100%)] px-5 py-8 text-foreground sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.1)] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="hidden bg-[#0b0b0c] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-10 xl:py-10">
            <div>
              <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-white/55">samm</p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold tracking-tight text-[#f5f3ef] xl:text-[2.7rem]">
                less marketing chaos
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/68 xl:text-[15px]">
                Coordinate campaigns, approvals, and execution from one calm control layer built for founders,
                operators, and lean teams.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {audienceTiles.map((tile) => {
                const Icon = tile.icon;

                return (
                  <div
                    key={tile.title}
                    className="group relative min-h-44 overflow-hidden rounded-[1.4rem] border border-white/8 bg-[#101113]"
                  >
                    <img
                      src={tile.image}
                      alt={tile.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,8,0.18)_0%,rgba(7,7,8,0.72)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)] opacity-70" />
                    <div className="relative flex h-full flex-col justify-between p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full border border-white/14 bg-black/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/78">
                          {tile.title}
                        </span>
                        <Icon className="h-4 w-4 text-white/80" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#f5f3ef]">{tile.title}</p>
                        <p className="mt-2 max-w-[15rem] text-[12px] leading-5 text-white/76">{tile.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full border border-white/12 bg-white/8 p-2">
                  <ClipboardCheck className="h-4 w-4 text-white/78" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">operator relief</p>
                  <p className="mt-2 text-sm leading-6 text-white/74">
                    Keep the work moving without carrying every approval, follow-up, and campaign handoff on your own.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-[#fcfbf8] px-6 py-10 sm:px-10 lg:px-12">
            <div className="w-full max-w-sm">
              <div className="text-center lg:text-left">
                <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/72">samm</p>
                <h2 className="mt-4 text-[2.15rem] font-semibold tracking-tight text-[#0b0b0c]">orchestrate the work</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Sign in to review approvals, coordinate execution, and keep your marketing flow aligned.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-xl border-black/10 bg-white pl-10"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ops@company.com"
                      required
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Password</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-xl border-black/10 bg-white pl-10"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </label>

                {error ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <Button className="h-11 w-full rounded-xl bg-[#0b0b0c] text-white hover:bg-[#171717]" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
