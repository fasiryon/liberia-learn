import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTextbookQueueStatus } from "@/lib/textbooks/textbookGenerationQueue";
import { TextbookGenerationClient } from "./TextbookGenerationClient";

export const dynamic = "force-dynamic";

export default async function TextbookGenerationPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const initialStatus = await getTextbookQueueStatus({ grade: 5, format: "student" });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn Textbook Ops</p>
          <h1 className="text-3xl font-bold">Textbook Generation Queue</h1>
          <p className="max-w-2xl text-sm text-[var(--ll-text-muted)]">
            Queue compiled curriculum textbooks for durable PDF storage. Jobs move from PENDING to PROCESSING to GENERATED, with failed jobs available for retry.
          </p>
        </header>

        <TextbookGenerationClient initialStatus={initialStatus} />
      </div>
    </main>
  );
}
