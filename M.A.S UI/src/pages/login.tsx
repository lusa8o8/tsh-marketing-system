import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  ArrowRight,
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
import { getAccessToken, signIn, signUp, supabase } from "@/lib/supabase";

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
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleMode() {
    setIsSignUp((prev) => !prev);
    setEmail("");
    setPassword("");
    setError(null);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (isSignUp) {
      const { data, error: signUpError } = await signUp(email, password);

      if (signUpError) {
        setError(signUpError.message);
        setIsSubmitting(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setError("Signup succeeded but no user ID returned. Check your email to confirm your account.");
        setIsSubmitting(false);
        return;
      }

      // Provision org — creates org_config + stamps org_id into app_metadata
      const token = await getAccessToken();
      const provisionRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-org`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId, email }),
        }
      );

      if (!provisionRes.ok) {
        const detail = await provisionRes.text();
        setError(`Org setup failed: ${detail}`);
        setIsSubmitting(false);
        return;
      }

      // Refresh session so the JWT contains the new org_id from app_metadata
      await supabase.auth.refreshSession();

      setLocation("/inbox");
      setIsSubmitting(false);
      return;
    }

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(116,152,214,0.18),transparent_28%),linear-gradient(180deg,#f7f4ee_0%,#f2efe8_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-[78rem] overflow-hidden rounded-[2.2rem] border border-black/10 bg-[rgba(255,255,255,0.78)] shadow-[0_28px_110px_rgba(15,23,42,0.12)] backdrop-blur-[6px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="hidden bg-[#0b0b0c] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-10 xl:py-10">
            <div>
              <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-white/55">samm</p>
              <h1 className="mt-4 max-w-md text-[2.5rem] font-semibold tracking-tight text-[#f5f3ef] xl:text-[2.85rem]">
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
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,8,0.12)_0%,rgba(7,7,8,0.78)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)] opacity-70" />
                    <div className="relative flex h-full flex-col justify-between p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full border border-white/14 bg-black/22 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/78">
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

          <div className="flex items-center justify-center bg-[#fcfbf8] px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
            <div className="w-full max-w-sm">
              <div className="rounded-[1.6rem] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,247,242,0.92))] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] lg:hidden">
                <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/66">samm</p>
                <h1 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[#0b0b0c]">less marketing chaos</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  One system to coordinate approvals, execution, and the work that keeps marketing moving.
                </p>
              </div>

              <div className="mt-6 text-center lg:mt-0 lg:text-left">
                <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/72">samm</p>
                <h2 className="mt-4 text-[2.1rem] font-semibold tracking-tight text-[#0b0b0c]">
                  {isSignUp ? "create your workspace" : "orchestrate the work"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {isSignUp
                    ? "Set up your samm account. Your workspace and pipelines will be ready immediately."
                    : "Sign in to review approvals, coordinate execution, and keep your marketing flow aligned."}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-[1.2rem] border border-black/8 bg-white/80 px-4 py-3 text-sm text-[#1b1b1c] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="rounded-full bg-[#0b0b0c] p-1.5 text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="font-medium">Built for operators under pressure</p>
                  <p className="text-[13px] text-muted-foreground">Calm control for campaigns, approvals, and execution.</p>
                </div>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-xl border-black/10 bg-white pl-10 shadow-[0_1px_0_rgba(255,255,255,0.35)]"
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
                      className="h-11 rounded-xl border-black/10 bg-white pl-10 shadow-[0_1px_0_rgba(255,255,255,0.35)]"
                      type="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
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

                <Button
                  className="h-11 w-full rounded-xl bg-[#0b0b0c] text-white hover:bg-[#171717]"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isSignUp ? "Setting up workspace..." : "Signing in..."
                    : isSignUp ? "Create workspace" : "Sign in"}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-[#0b0b0c] underline underline-offset-4 hover:opacity-70"
                  onClick={toggleMode}
                >
                  {isSignUp ? "Sign in" : "Create workspace"}
                </button>
              </p>

              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground lg:justify-start">
                <Link href="/" className="underline underline-offset-4 transition-opacity hover:opacity-70">
                  Homepage
                </Link>
                <Link href="/privacy" className="underline underline-offset-4 transition-opacity hover:opacity-70">
                  Privacy
                </Link>
                <Link href="/terms" className="underline underline-offset-4 transition-opacity hover:opacity-70">
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
