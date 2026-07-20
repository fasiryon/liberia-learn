import Link from "next/link";

const GUIDES = [
  {
    role: "Student",
    href: "/help/student",
    description: "Find lessons, complete work, track progress, and use support tools",
    color: "#f59e0b",
  },
  {
    role: "Admin",
    href: "/help/admin",
    description: "Create classes, enroll students, manage your school",
    color: "var(--ll-yellow)",
  },
  {
    role: "Teacher",
    href: "/help/teacher",
    description: "Assign homework, review submissions, track class progress",
    color: "#60a5fa",
  },
  {
    role: "Guardian",
    href: "/help/guardian",
    description: "Review learner progress, support plans, events, and messages",
    color: "#f472b6",
  },
  {
    role: "MOE Official",
    href: "/help/moe",
    description: "Read school performance reports and national dashboards",
    color: "#34d399",
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Help &amp; Guides</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Step-by-step guides for every role on the LiberiaLearn platform.
        </p>
      </div>

      <div className="grid gap-4">
        {GUIDES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group flex items-start gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 hover:border-[var(--ll-yellow)]/50 transition-colors"
          >
            <div
              className="mt-0.5 h-3 w-3 rounded-full shrink-0"
              style={{ background: g.color }}
            />
            <div>
              <p className="font-semibold text-[var(--ll-text)] group-hover:text-[var(--ll-yellow)] transition-colors">
                {g.role}
              </p>
              <p className="text-sm text-[var(--ll-text-muted)] mt-0.5">{g.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-[var(--ll-text-faint)]">
        Need more help? Contact your school administrator or email{" "}
        <a
          href="mailto:support@liberialearn.edu.lr"
          className="underline hover:text-[var(--ll-text-muted)]"
        >
          support@liberialearn.edu.lr
        </a>
        .
      </p>
    </div>
  );
}
