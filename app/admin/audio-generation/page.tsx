import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAudioQueueStatus } from "@/lib/audio/audioGenerationQueue";
import { AudioGenerationClient } from "./AudioGenerationClient";

export const dynamic = "force-dynamic";

export default async function AudioGenerationPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const initialStatus = await getAudioQueueStatus({ grade: 5, subject: "ENGLISH" });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_60%)]" />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn Audio Ops</p>
          <h1 className="text-3xl font-bold">Audio Generation Queue</h1>
          <p className="max-w-2xl text-sm text-[var(--ll-text-muted)]">
            Manage TTS audio generation for curriculum lessons. Jobs move from PENDING → PROCESSING → GENERATED. Failed jobs can be retried.
          </p>
        </header>

        <AudioGenerationClient initialStatus={initialStatus} />
      </div>
    </main>
  );
}
