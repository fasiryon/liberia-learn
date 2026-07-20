import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getTrainingCompletionRecord,
  TRAINING_RECORD_DISCLAIMER,
  TRAINING_RECORD_NAME,
} from "@/lib/training/completionRecord";
import { isTrainingCenterEnabled } from "@/lib/serverFlags";
import { PrintRecordButton } from "./PrintRecordButton";

export const dynamic = "force-dynamic";

export default async function TeacherTrainingCompletionRecordPage() {
  if (!isTrainingCenterEnabled()) {
    redirect("/teacher");
  }

  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  if (user.role !== "TEACHER" && user.role !== "ADMIN") redirect("/");

  const record = await getTrainingCompletionRecord(user.id);
  const completionDate = record.completionDate
    ? new Date(record.completionDate).toLocaleDateString("en-LR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)] print:bg-white print:text-black">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/teacher/training"
            className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold"
          >
            Back to training
          </Link>
          <PrintRecordButton />
        </div>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/90 p-8 print:border-black print:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)] print:text-black">
            LiberiaLearn
          </p>
          <h1 className="mt-3 text-3xl font-bold">{TRAINING_RECORD_NAME}</h1>

          {!record.completed ? (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] p-5 print:border-black print:bg-white">
              <h2 className="text-lg font-semibold">Record not ready yet</h2>
              <p className="mt-2 text-sm">
                {record.completedModules} of {record.totalModules} modules are complete. Finish all
                training modules to generate this record.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div>
                <p className="text-sm text-[var(--ll-text-muted)] print:text-black">Issued to</p>
                <p className="mt-1 text-2xl font-semibold">{record.teacherName}</p>
                <p className="text-sm text-[var(--ll-text-muted)] print:text-black">
                  {record.schoolName}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--ll-border)] p-4 print:border-black">
                  <p className="text-xs uppercase tracking-wide">Modules</p>
                  <p className="mt-2 text-xl font-semibold">
                    {record.completedModules}/{record.totalModules}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--ll-border)] p-4 print:border-black">
                  <p className="text-xs uppercase tracking-wide">Completed</p>
                  <p className="mt-2 text-xl font-semibold">{completionDate}</p>
                </div>
                <div className="rounded-lg border border-[var(--ll-border)] p-4 print:border-black">
                  <p className="text-xs uppercase tracking-wide">Record code</p>
                  <p className="mt-2 text-xl font-semibold">{record.recordCode}</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold">Training badges earned</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.badges.map((badge) => (
                    <span
                      key={badge.name}
                      className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-sm print:border-black"
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold">Module evidence</h2>
            <div className="mt-3 divide-y divide-[var(--ll-border)] rounded-lg border border-[var(--ll-border)] print:border-black">
              {record.modules.map((module) => (
                <div key={module.id} className="flex justify-between gap-4 p-3 text-sm">
                  <span>{module.title}</span>
                  <span className="font-semibold">{module.status.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-8 border-t border-[var(--ll-border)] pt-4 text-xs leading-5 text-[var(--ll-text-muted)] print:border-black print:text-black">
            {TRAINING_RECORD_DISCLAIMER}
          </p>
        </section>
      </div>
    </main>
  );
}
