import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams?: { schoolId?: string; action?: string };
}) {
  const user = await requirePlatformAdmin().catch(() => null);
  if (!user) redirect("/login");

  const schoolIdFilter =
    typeof searchParams?.schoolId === "string" ? searchParams.schoolId.trim() : "";
  const actionFilter =
    typeof searchParams?.action === "string" ? searchParams.action.trim() : "";

  const where: any = {};
  if (actionFilter) {
    where.action = actionFilter;
  }
  if (schoolIdFilter) {
    where.OR = [{ schoolId: schoolIdFilter }, { user: { schoolId: schoolIdFilter } }];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true, role: true, schoolId: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Audit Log</h1>
        <p className="text-sm text-slate-400 mt-1">
          Immutable record of all administrative actions across the platform.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <form className="flex flex-wrap items-end gap-3 pb-4" method="GET">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            School ID
            <input
              name="schoolId"
              defaultValue={schoolIdFilter}
              className="rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="cuid..."
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Action
            <input
              name="action"
              defaultValue={actionFilter}
              className="rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="pilot.update"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30"
          >
            Filter
          </button>
          <a
            href="/platform/audit"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Clear
          </a>
        </form>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3">Timestamp</th>
                  <th className="pb-2 pr-3">School</th>
                  <th className="pb-2 pr-3">User</th>
                  <th className="pb-2 pr-3">Action</th>
                  <th className="pb-2 pr-3">Resource</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-800/50 text-slate-300"
                  >
                    <td className="py-2 pr-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-400">
                      {(log.schoolId ?? log.user?.schoolId ?? "--")?.slice(0, 12)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {log.user?.email ?? log.userId ?? "system"}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-100">
                      {log.action}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-400">
                      {log.resourceType && (
                        <span>
                          {log.resourceType}
                          {log.resourceId && `: ${log.resourceId.slice(0, 12)}...`}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-500 max-w-xs truncate">
                      {log.details
                        ? JSON.stringify(log.details).slice(0, 80)
                        : "--"}
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
