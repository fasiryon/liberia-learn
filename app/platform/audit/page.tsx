import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";

export const dynamic = "force-dynamic";

export default async function PlatformAuditPage() {
  let user = null;
  try {
    user = await requireMoePlatformAdmin();
  } catch (err: any) {
    if (err?.status === 404) notFound();
    redirect("/login");
  }

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
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Immutable record of all administrative actions across the platform.
        </p>
      </div>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
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
                    className="border-b border-[var(--ll-border)]/50 text-[var(--ll-text)]"
                  >
                    <td className="py-2 pr-3 text-xs text-[var(--ll-text-faint)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {log.user?.email ?? log.userId ?? "system"}
                    </td>
                    <td className="py-2 pr-3 font-medium text-[var(--ll-text)]">
                      {log.action}
                    </td>
                    <td className="py-2 pr-3 text-xs text-[var(--ll-text-muted)]">
                      {log.resourceType && (
                        <span>
                          {log.resourceType}
                          {log.resourceId && `: ${log.resourceId.slice(0, 12)}...`}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-[var(--ll-text-faint)] max-w-xs truncate">
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
