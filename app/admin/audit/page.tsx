import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) redirect("/login");

  // Get school users to filter logs
  const schoolId = user.schoolId;
  let logs;
  if (schoolId) {
    const schoolUsers = await prisma.user.findMany({
      where: { schoolId },
      select: { id: true },
    });
    const userIds = schoolUsers.map((u) => u.id);
    logs = await prisma.auditLog.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true, role: true } },
      },
    });
  } else {
    logs = await prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true, name: true, role: true } },
      },
    });
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <a href="/admin" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Admin
        </a>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          Record of administrative actions for your school.
        </p>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="pb-2 pr-3">Time</th>
                    <th className="pb-2 pr-3">User</th>
                    <th className="pb-2 pr-3">Action</th>
                    <th className="pb-2 pr-3">Resource</th>
                    <th className="pb-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[var(--ll-border)]/50 text-[var(--ll-text)]">
                      <td className="py-2 pr-3 text-xs text-[var(--ll-text-faint)] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-xs">{log.user?.email ?? "--"}</td>
                      <td className="py-2 pr-3 font-medium text-[var(--ll-text)]">{log.action}</td>
                      <td className="py-2 pr-3 text-xs text-[var(--ll-text-muted)]">
                        {log.resourceType ?? ""}
                        {log.resourceId ? `: ${log.resourceId.slice(0, 12)}` : ""}
                      </td>
                      <td className="py-2 text-xs text-[var(--ll-text-faint)] max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details).slice(0, 60) : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
