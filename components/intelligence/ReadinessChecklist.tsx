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
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
    : "bg-amber-500/15 text-amber-300 border-amber-500/20";
}

export function ReadinessChecklist({
  sections,
}: {
  sections: ReadinessSectionView[];
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id} className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{section.title}</h2>
              {typeof section.score === "number" ? (
                <p className="mt-1 text-xs text-slate-500">
                  Score {section.score}/100
                  {typeof section.weight === "number" ? ` • Weight ${section.weight}%` : ""}
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
              <div key={check.label} className="rounded-2xl bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">{check.label}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${marker(check.ready)}`}>
                    {check.ready ? "OK" : "Missing"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{check.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
