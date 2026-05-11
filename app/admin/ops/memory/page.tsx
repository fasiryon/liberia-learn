import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { retrieveOperationalMemory } from "@/lib/autonomous/memory/memoryRetrievalService";

export const dynamic = "force-dynamic";

export default async function OperationalMemoryPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const memory = await retrieveOperationalMemory({ requester: user, schoolId: user.isPlatformAdmin ? null : user.schoolId, limit: 100 });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Institutional Learning</p>
          <h1 className="text-2xl font-semibold">Operational Memory</h1>
        </header>
        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr><th className="px-3 py-2">Memory</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">Sensitivity</th><th className="px-3 py-2">Lineage</th></tr>
            </thead>
            <tbody>
              {memory.map((item: any) => (
                <tr key={item.id} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2"><div className="font-medium">{item.memoryType}</div><div className="text-xs text-[var(--ll-text-muted)]">{item.summary}</div></td>
                  <td className="px-3 py-2">{item.scope}</td>
                  <td className="px-3 py-2">{item.confidence}</td>
                  <td className="px-3 py-2">{item.sensitivity}</td>
                  <td className="px-3 py-2"><Link className="underline" href={`/admin/ops/memory/${item.id}`}>View lineage</Link></td>
                </tr>
              ))}
              {memory.length === 0 ? <tr><td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={5}>No operational memory recorded.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

