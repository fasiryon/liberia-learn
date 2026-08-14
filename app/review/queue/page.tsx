import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isP2bReviewOperationsEnabled } from "@/lib/serverFlags";
import { listReviewQueue } from "@/lib/curriculum/review/tasks";
import { queueSchoolFilter } from "@/lib/curriculum/review/access";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  if (!isP2bReviewOperationsEnabled()) notFound();
  const user = await requireUser();
  const tasks = await listReviewQueue({ schoolId: queueSchoolFilter(user), limit: 100 });
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Qualified review queue</h1>
          <p className="text-sm text-slate-600">Exact revisions ordered by risk band, score, due time, and creation time.</p>
        </div>
        <Link href="/review/operations" className="rounded border px-3 py-2 text-sm">Operations</Link>
      </div>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3">Priority</th><th className="p-3">Content</th><th className="p-3">Scope</th><th className="p-3">State</th><th className="p-3">Due</th></tr></thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t">
                <td className="p-3"><span className="font-semibold">{task.priorityBand}</span><div>{task.priorityScore}</div></td>
                <td className="p-3"><Link className="font-medium text-blue-700 underline" href={`/review/tasks/${task.id}`}>{task.provenance.curriculumContent.title ?? task.provenance.curriculumContent.contentId}</Link><div className="text-xs text-slate-500">Revision {task.revisionId}</div></td>
                <td className="p-3">{task.provenance.curriculumContent.subject}, grade {task.provenance.curriculumContent.grade}<div>{task.requiredAuthority}, {task.requiredReviewCount} reviewer{task.requiredReviewCount === 1 ? "" : "s"}</div></td>
                <td className="p-3">{task.status}</td>
                <td className="p-3">{task.dueAt.toLocaleString()}</td>
              </tr>
            ))}
            {!tasks.length && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No eligible-scope tasks are queued.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
