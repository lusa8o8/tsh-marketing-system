import { Link } from "wouter";

const sections = [
  {
    title: "Information we collect",
    body:
      "We collect the information needed to create and operate a samm workspace, including account details, workspace configuration, connected channel details, and the content or approvals needed to run your workflows.",
  },
  {
    title: "How we use information",
    body:
      "We use information to provide the product, coordinate approvals, generate and store content, improve reliability, and support workspace operations. We do not use your workspace content for unrelated public marketing without permission.",
  },
  {
    title: "How we protect information",
    body:
      "We use reasonable technical and operational safeguards to protect account data, workspace settings, and workflow content. Access is limited to the systems and people needed to operate the service.",
  },
  {
    title: "Contact",
    body:
      "If you have privacy questions, contact hello@getsamm.app. You can also use the contact details published on getsamm.app.",
  },
] as const;

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f3efe7_100%)] px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-black/8 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-8 lg:px-10">
        <p className="text-[11px] font-semibold lowercase tracking-[0.24em] text-foreground/55">samm</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0b0b0c]">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          This is how samm handles account, workspace, and content information across the product.
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
          <Link href="/terms" className="font-medium text-[#0b0b0c] underline underline-offset-4">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
