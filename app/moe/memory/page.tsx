import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { retrieveOperationalMemory } from "@/lib/autonomous/memory/memoryRetrievalService";

export const dynamic = "force-dynamic";

export default async function MoeMemoryPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && !["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "DISTRICT_ADMIN"].includes(String(user.role))) redirect("/");
  const memory = await retrieveOperationalMemory({
    requester: user,
    aggregateOnly: true,
    memoryTypes: ["DISTRICT_PATTERN", "NATIONAL_PATTERN"],
    limit: 100,
  });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">MOE Aggregate Memory</p>
          <h1 className="text-2xl font-semibold">Institutional Patterns</h1>
        </header>
        <section className="space-y-3">
          {memory.map((item: any) => (
            <div key={item.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
              <div className="font-medium">{item.memoryType} · {item.scope}</div>
              <div className="mt-2">{item.summary}</div>
              <div className="mt-2 text-[var(--ll-text-muted)]">Confidence {item.confidence} · {item.sensitivity}</div>
            </div>
          ))}
          {memory.length === 0 ? <div className="rounded border border-[var(--ll-border)] p-6 text-center text-sm text-[var(--ll-text-muted)]">No aggregate-safe memory recorded.</div> : null}
        </section>
      </div>
    </main>
  );
}

