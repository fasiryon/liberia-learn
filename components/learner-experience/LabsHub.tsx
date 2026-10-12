import Link from "next/link";
import { LabExperienceCard } from "@/components/learner-experience/LabExperienceCard";
import type { LabExperience } from "@/lib/learner-experience/labExperience";
import { LABS_TAB_SECTIONS, type LabsTabModel } from "@/lib/learner-experience/labsTab";

type LabsSectionId = (typeof LABS_TAB_SECTIONS)[number]["id"];

const EMPTY: Record<LabsSectionId, string> = {
  "for-you": "Labs linked to the lessons you are learning will appear here.",
  assigned: "No labs have been assigned yet.",
  continue: "You have no unfinished labs.",
  library: "No released labs are available for your classes yet.",
  completed: "Labs you finish will appear here.",
};

/** The section shown when the URL names none: For You, then Continue, then Library. */
export function activeLabsSection(tab: LabsTabModel, requested: string | null) {
  const fallback = tab.forYou.length ? "for-you" : tab.continue.length ? "continue" : "library";
  return LABS_TAB_SECTIONS.find((section) => section.id === requested) ?? LABS_TAB_SECTIONS.find((section) => section.id === fallback)!;
}

/**
 * Labs hub presentation. `showcase` holds only labs the server granted to this
 * learner; the view never decides access itself.
 */
export function LabsHubView({ tab, requested, showcase, aiLabsEnabled }: { tab: LabsTabModel; requested: string | null; showcase: readonly LabExperience[]; aiLabsEnabled: boolean }) {
  const active = activeLabsSection(tab, requested);
  const entries = tab[active.key];
  return (
    <div className="ll-dashboard-shell">
      <main className="px-4 py-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Labs</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">Explore, test ideas and see science happen.</p>
            </div>
            {!aiLabsEnabled ? (
              <span className="rounded-full border border-[var(--ll-border)] bg-[rgba(250,204,21,0.08)] px-3 py-1 text-xs font-medium text-[var(--ll-warning)]">AI lab helpers disabled</span>
            ) : null}
          </div>

          {showcase.length > 0 ? (
            <section aria-labelledby="showcase-labs-title" className="space-y-3">
              <div>
                <h2 id="showcase-labs-title" className="text-lg font-semibold text-[var(--ll-text)]">Interactive labs</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">Open a lab to explore it. These are not linked to your lessons.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {showcase.map((lab) => (
                  <LabExperienceCard key={`showcase:${lab.labId}`} lab={lab} session={null} reason={null} badge="Showcase Lab" />
                ))}
              </div>
            </section>
          ) : null}

          <nav aria-label="Lab sections" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex min-w-max gap-2">
              {LABS_TAB_SECTIONS.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`/student/labs?tab=${section.id}`}
                    aria-current={section.id === active.id ? "page" : undefined}
                    className={`inline-flex min-h-[var(--pdv2-target,44px)] items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ll-accent)] ${section.id === active.id ? "border-[var(--ll-accent)] bg-[var(--ll-accent)] text-[var(--ll-bg)]" : "border-[var(--ll-border)] text-[var(--ll-text-muted)]"}`}
                  >
                    {section.label}
                    <span className="text-xs opacity-80">{tab[section.key].length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="labs-section-title">
            <h2 id="labs-section-title" className="sr-only">{active.label}</h2>
            {entries.length === 0 ? (
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-6 text-center">
                <p className="text-sm text-[var(--ll-text-muted)]">{EMPTY[active.id]}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <LabExperienceCard key={`${entry.lab.labId}:${entry.session?.sessionId ?? "library"}`} lab={entry.lab} session={entry.session} reason={entry.reason} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
