import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { getPilotDashboardRows } from "@/lib/pilot-dashboard";

export const dynamic = "force-dynamic";

export default async function PilotSchoolsPage() {
  await requirePlatformAdmin();
  const rows = await getPilotDashboardRows();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pilot Schools Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Readiness and onboarding status for active pilot schools.
          </p>
        </div>
        <a
          href="/api/platform/reports?type=pilot&format=csv"
          className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No pilot schools found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3">School</th>
                  <th className="pb-2 pr-3">County</th>
                  <th className="pb-2 pr-3">Onboarding</th>
                  <th className="pb-2 pr-3">Readiness Score</th>
                  <th className="pb-2 pr-3">Pilot Status</th>
                  <th className="pb-2 pr-3">Pilot Cohort</th>
                  <th className="pb-2 pr-3">Contact Email Verified</th>
                  <th className="pb-2">Contact Phone Verified</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-800/50 text-slate-300"
                  >
                    <td className="py-3 pr-3 font-medium text-slate-100">
                      <Link
                        href={`/platform/schools/${row.id}`}
                        className="hover:text-emerald-200"
                      >
                        {row.schoolName}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">{row.county || "--"}</td>
                    <td className="py-3 pr-3 text-xs text-slate-400">
                      {row.onboardingStatus}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-100">
                      {row.readinessScore}
                    </td>
                    <td className="py-3 pr-3">{row.pilotStatus || "--"}</td>
                    <td className="py-3 pr-3">{row.pilotCohort || "--"}</td>
                    <td className="py-3 pr-3 text-xs">
                      {row.contactEmailVerified ? "Yes" : "No"}
                    </td>
                    <td className="py-3 text-xs">
                      {row.contactPhoneVerified ? "Yes" : "No"}
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
