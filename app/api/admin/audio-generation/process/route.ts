import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { claimNextAudioJobs, processAudioJob } from "@/lib/audio/audioGenerationQueue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(5, Math.max(1, Number(body?.limit ?? 5)));

    const jobs = await claimNextAudioJobs({ limit });
    if (jobs.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0, results: [] });
    }

    const results = [];
    for (const job of jobs) {
      const result = await processAudioJob(job.id);
      results.push(result);
    }

    const processed = results.filter((r) => r.status === "GENERATED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;

    return NextResponse.json({ processed, failed, results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Audio processing failed" },
      { status: error?.status ?? 500 }
    );
  }
}
