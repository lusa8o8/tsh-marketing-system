import { Link } from "wouter";

const sections = [
  {
    title: "Using samm",
    body:
      "samm is provided as a marketing workspace for planning campaigns, reviewing approvals, coordinating content, and managing workflow activity. You are responsible for how your team uses the product and any connected channels.",
  },
  {
    title: "Accounts and workspace access",
    body:
      "You are responsible for maintaining the security of your account and for controlling who can access your workspace. Keep your credentials secure and remove access when it is no longer needed.",
  },
  {
    title: "Content and connected channels",
    body:
      "You retain responsibility for the content, approvals, and publishing decisions made in your workspace. Connected third-party platforms remain subject to their own policies, permissions, and compliance requirements.",
  },
  {
    title: "Contact",
    body:
      "Questions about these terms can be sent to hello@getsamm.app. Additional business contact details are available on getsamm.app.",
  },
] as const;

export default function Terms() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f3efe7_100%)] px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-black/8 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-8 lg:px-10">
        <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/55">samm</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0b0b0c]">Terms of Service</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          These are the general rules for using samm as a marketing workflow product.
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-[#0b0b0c]">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="font-medium text-[#0b0b0c] underline underline-offset-4">
            Back to homepage
          </Link>
          <Link href="/privacy" className="font-medium text-[#0b0b0c] underline underline-offset-4">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
