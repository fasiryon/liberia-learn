import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlatformAuditPage() {
  const user = await requirePlatformAdmin().catch(() => null);
  if (!user) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true, role: true } },
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
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3">Timestamp</th>
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

