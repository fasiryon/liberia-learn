import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMemoryLineage } from "@/lib/autonomous/memory/memoryLineageService";

export const dynamic = "force-dynamic";

export default async function MemoryLineagePage({ params }: { params: { memoryEventId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const lineage = await getMemoryLineage(params.memoryEventId).catch(() => null);
  if (!lineage) notFound();
  if (!user.isPlatformAdmin && lineage.schoolId && lineage.schoolId !== user.schoolId) redirect("/");
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/memory">Back to memory</Link>
          <h1 className="mt-2 text-2xl font-semibold">Memory Lineage</h1>
        </header>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <pre className="overflow-x-auto text-xs">{JSON.stringify(lineage, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}

