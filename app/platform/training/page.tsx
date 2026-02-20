import { requirePlatformAdmin } from "@/lib/auth";
import { getTrainingReportRows } from "@/lib/training-report";

export const dynamic = "force-dynamic";

export default async function PlatformTrainingPage({
  searchParams,
}: {
  searchParams?: { schoolId?: string; pilotOnly?: string };
}) {
  await requirePlatformAdmin();

  const schoolId = typeof searchParams?.schoolId === "string" ? searchParams.schoolId.trim() : "";
  const pilotOnlyParam = typeof searchParams?.pilotOnly === "string" ? searchParams.pilotOnly : "";
  const pilotOnly = pilotOnlyParam === "" ? true : pilotOnlyParam !== "false";

  const rows = await getTrainingReportRows({
    schoolId: schoolId || undefined,
    pilotOnly,
  });

  const exportUrl = `/api/platform/reports?type=training&format=csv&pilotOnly=${pilotOnly}${
    schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teacher Training Progress</h1>
          <p className="text-sm text-slate-400">
            Completion progress across active training modules.
          </p>
        </div>
        <a
          href={exportUrl}
          className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
        <form className="flex flex-wrap items-end gap-3" method="GET">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            School ID
            <input
              name="schoolId"
              defaultValue={schoolId}
              className="rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="cuid..."
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="hidden" name="pilotOnly" value="false" />
            <input type="checkbox" name="pilotOnly" value="true" defaultChecked={pilotOnly} />
            Pilot schools only
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30"
          >
            Filter
          </button>
          <a href="/platform/training" className="text-sm text-slate-400 hover:text-slate-200">
            Clear
          </a>
        </form>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No training progress found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3">Teacher</th>
                  <th className="pb-2 pr-3">School</th>
                  <th className="pb-2 pr-3">County</th>
                  <th className="pb-2 pr-3">Completion</th>
                  <th className="pb-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.teacherId} className="border-b border-slate-800/50 text-slate-300">
                    <td className="py-3 pr-3 font-medium text-slate-100">
                      {row.teacherName}
                    </td>
                    <td className="py-3 pr-3">{row.schoolName}</td>
                    <td className="py-3 pr-3">{row.county || "--"}</td>
                    <td className="py-3 pr-3 text-xs text-slate-200">
                      {row.completedModules}/{row.totalModules} ({row.completionPct}%)
                    </td>
                    <td className="py-3 text-xs text-slate-400">
                      {row.lastActivity ? row.lastActivity.toISOString().slice(0, 10) : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
