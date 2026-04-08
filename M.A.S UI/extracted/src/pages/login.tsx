import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/supabase";

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden border-r border-border bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/50">TSH</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">Marketing OS</h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/70">
                Sign in to access inbox approvals, content planning, academic calendar triggers, and pipeline monitoring.
              </p>
            </div>
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/40">Operator access</p>
              <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">
                Your Supabase session carries the organization claim that unlocks dashboard data through RLS.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-sm">
              <div className="text-center lg:text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">TSH</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Marketing OS</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in with your operator account to load the dashboard.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 pl-10"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ops@tsh.com"
                      required
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Password</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 pl-10"
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
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
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
