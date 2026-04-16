import { Link } from "wouter";
import { ArrowRight, Bell, Bot, CalendarDays, CheckCircle2, LayoutList, Mail, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import founderReviewImage from "@/assets/login/founder-review.jpg";
import leanTeamImage from "@/assets/login/lean-team.jpg";
import operatorMonitorImage from "@/assets/login/operator-monitor.jpg";
import ownerWorkflowImage from "@/assets/login/owner-workflow.jpg";
import { Button } from "@/components/ui/button";

const productPanels = [
  {
    eyebrow: "samm chat",
    title: "Coordinate the next move",
    description: "Ask for a summary, draft a post, or start a campaign without losing the thread of what is already in motion.",
    icon: Sparkles,
  },
  {
    eyebrow: "Inbox approvals",
    title: "See what needs a decision",
    description: "Approvals, escalations, and campaign checkpoints surface in one place so work keeps moving without guesswork.",
    icon: Bell,
  },
  {
    eyebrow: "Content registry",
    title: "Review drafts before they go live",
    description: "Campaign assets, one-off posts, and channel-ready copy stay visible until someone approves the next step.",
    icon: LayoutList,
  },
  {
    eyebrow: "Operations",
    title: "Watch the workflow end to end",
    description: "Track runs, failures, approvals, and pipeline status from one operational view instead of stitching together tabs.",
    icon: Bot,
  },
];

const valuePoints = [
  "Marketing approval workflow for founders, operators, and lean teams",
  "Plan campaigns, approve content, and keep execution moving in one place",
  "Social media management with a real operations layer, not just a scheduler",
];

const audienceTiles = [
  {
    title: "Founders",
    description: "Get fast visibility into what is moving, what is blocked, and what needs a decision.",
    image: founderReviewImage,
  },
  {
    title: "Lean teams",
    description: "Keep planning, approvals, publishing, and follow-through aligned without a pile of manual check-ins.",
    image: leanTeamImage,
  },
  {
    title: "Operators",
    description: "Run campaigns and approvals from one calm control layer instead of juggling inboxes, docs, and schedulers.",
    image: operatorMonitorImage,
  },
  {
    title: "Owners",
    description: "Stay close to results without becoming the bottleneck for every approval or handoff.",
    image: ownerWorkflowImage,
  },
] as const;

function ProductWindow({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="rounded-[1.6rem] border border-black/8 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">{eyebrow}</span>
        <Icon className="h-4 w-4 text-foreground/45" />
      </div>

      <div className="mt-5 rounded-[1.2rem] border border-black/8 bg-[#fcfbf8] p-4">
        <div className="flex items-center justify-between border-b border-black/8 pb-3">
          <div>
            <p className="text-sm font-semibold text-[#0b0b0c]">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-full bg-[#0b0b0c] px-3 py-1 text-[11px] font-medium text-white">Live</div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-black/8 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0b0b0c]">What is moving now</p>
              <span className="rounded-full bg-[#eef5ed] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f6b3b]">
                clear
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Drafts, approvals, and campaign runs are visible without digging through separate tools or threads.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/8 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">Approvals</p>
              <p className="mt-2 text-sm font-medium text-[#0b0b0c]">Review copy before it goes live</p>
            </div>
            <div className="rounded-xl border border-black/8 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">Status</p>
              <p className="mt-2 text-sm font-medium text-[#0b0b0c]">Track runs, failures, and next steps</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(116,152,214,0.18),transparent_26%),linear-gradient(180deg,#f7f4ee_0%,#f3efe7_100%)] text-foreground">
      <header className="sticky top-0 z-20 border-b border-black/6 bg-[rgba(247,244,238,0.82)] backdrop-blur-[14px]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/55">samm</p>
            <p className="mt-1 text-sm font-medium text-foreground/75">marketing workflow and approvals</p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-full px-4">
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button className="rounded-full bg-[#0b0b0c] px-5 text-white hover:bg-[#171717]">Create workspace</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/45">Less marketing chaos</p>
              <h1 className="mt-4 max-w-xl text-[3rem] font-semibold tracking-tight text-[#0b0b0c] sm:text-[3.65rem]">
                Plan campaigns, approve content, and keep execution moving.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                samm helps small teams coordinate content, approvals, and campaign execution from one calm control layer.
                It is marketing operations software built for founders, operators, and lean teams that need the work to stay on track.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login">
                  <Button className="rounded-full bg-[#0b0b0c] px-6 text-white hover:bg-[#171717]">
                    Create workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#workflow">
                  <Button variant="outline" className="rounded-full border-black/10 bg-white/70 px-6">
                    See how it works
                  </Button>
                </a>
              </div>

              <div className="mt-8 space-y-3">
                {valuePoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 text-sm text-foreground/78">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6b3b]" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {productPanels.map((panel) => (
                <ProductWindow key={panel.title} {...panel} />
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-black/6 bg-[rgba(255,255,255,0.6)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/45">Product proof</p>
              <h2 className="mt-3 text-[2.3rem] font-semibold tracking-tight text-[#0b0b0c]">
                See what is moving, what is blocked, and what needs your approval.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                samm gives small teams a marketing approval workflow that is actually operational: campaigns, one-off posts,
                inbox decisions, schedules, and status all stay visible in one place.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[1.8rem] border border-black/8 bg-[#0b0b0c] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Meet samm</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[#f5f3ef]">A coordinating layer, not just another scheduler.</h3>
                  </div>
                  <Sparkles className="h-5 w-5 text-white/68" />
                </div>

                <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm leading-7 text-white/78">
                    samm watches runs, tracks approvals, reads calendar context, and helps route the next action.
                    It is the differentiator behind the workflow: less chasing, less guessing, and less marketing chaos.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Ask samm</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Start a campaign, prepare a pipeline, or draft a one-off post without losing the surrounding context.
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Keep control</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      Human approvals stay in the loop while the system keeps the workflow moving behind the scenes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.6rem] border border-black/8 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-foreground/55" />
                    <p className="text-sm font-semibold text-[#0b0b0c]">Plan around real dates</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Create event-driven campaigns, add audience context, and give the system a real trigger instead of disconnected reminders.
                  </p>
                </div>

                <div className="rounded-[1.6rem] border border-black/8 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-3">
                    <LayoutList className="h-4 w-4 text-foreground/55" />
                    <p className="text-sm font-semibold text-[#0b0b0c]">Approve before publishing</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Review campaign assets, weekly drafts, and one-off copy in one content registry before anything goes live.
                  </p>
                </div>

                <div className="rounded-[1.6rem] border border-black/8 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-3">
                    <Bot className="h-4 w-4 text-foreground/55" />
                    <p className="text-sm font-semibold text-[#0b0b0c]">Run a modular workspace</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Turn optional modules on or off, keep the workflow lean, and shape the system around how your team actually works.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/45">Who it is for</p>
            <h2 className="mt-3 text-[2.3rem] font-semibold tracking-tight text-[#0b0b0c]">
              Built for founders, operators, and lean teams that need the work to keep moving.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {audienceTiles.map((tile) => (
              <div key={tile.title} className="group relative min-h-[22rem] overflow-hidden rounded-[1.6rem] border border-black/8 bg-[#101113]">
                <img src={tile.image} alt={tile.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,8,0.12)_0%,rgba(7,7,8,0.82)_100%)]" />
                <div className="relative flex h-full flex-col justify-end p-5 text-white">
                  <span className="mb-3 inline-flex w-fit rounded-full border border-white/14 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                    {tile.title}
                  </span>
                  <p className="text-lg font-semibold text-[#f5f3ef]">{tile.title}</p>
                  <p className="mt-3 text-sm leading-6 text-white/74">{tile.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-black/6 bg-[#0b0b0c] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-white/45">samm</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#f5f3ef]">A marketing workspace built to buy back time.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
              samm helps teams plan campaigns, approve content, and keep execution moving from one place. Built for small
              teams that need calm control over real marketing work.
            </p>

            <div className="mt-6 flex flex-col gap-3 text-sm text-white/72 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>hello@getsamm.app</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Lusaka, Zambia</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Product information, legal details, and business contact information</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Explore</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/72">
                <Link href="/login" className="transition-opacity hover:opacity-70">
                  Sign in
                </Link>
                <Link href="/login" className="transition-opacity hover:opacity-70">
                  Create workspace
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Legal</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/72">
                <Link href="/privacy" className="transition-opacity hover:opacity-70">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="transition-opacity hover:opacity-70">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
