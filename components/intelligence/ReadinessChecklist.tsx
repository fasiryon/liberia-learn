import { Card } from "@/components/ui/Card";

export type ReadinessSectionView = {
  id: string;
  title: string;
  ready: boolean;
  score?: number;
  weight?: number;
  checks: Array<{
    label: string;
    ready: boolean;
    detail: string;
  }>;
};

function marker(ready: boolean) {
  return ready
    ? "border-emerald-500/20 bg-[var(--ll-yellow)]/15 text-[var(--ll-yellow)]"
    : "border-amber-500/20 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]";
}

export function ReadinessChecklist({
  sections,
}: {
  sections: ReadinessSectionView[];
}) {
  const readyCount = sections.filter((section) => section.ready).length;

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--ll-text)]">Section summary</h2>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          {readyCount} of {sections.length} readiness sections are currently ready.
        </p>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">{section.title}</h2>
              {typeof section.score === "number" ? (
                <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                  Score {section.score}/100
                  {typeof section.weight === "number" ? ` | Weight ${section.weight}%` : ""}
                </p>
              ) : null}
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${marker(section.ready)}`}
            >
              {section.ready ? "Ready" : "Needs work"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {section.checks.map((check) => (
              <div key={check.label} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-[var(--ll-text)]">{check.label}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${marker(check.ready)}`}
                  >
                    {check.ready ? "OK" : "Missing"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{check.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
