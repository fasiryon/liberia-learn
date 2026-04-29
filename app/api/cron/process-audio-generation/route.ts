import { NextResponse } from "next/server";
import { claimNextAudioJobs, processAudioJob, releaseClaimedAudioJobs } from "@/lib/audio/audioGenerationQueue";
import { getCronCostThresholdUsd, logCronRun, shouldStopForFailureRate } from "@/lib/automation/cronRunLog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(5, Math.max(1, Number(body?.limit ?? 5)));
    const costThresholdUsd = getCronCostThresholdUsd("audio");

    const jobs = await claimNextAudioJobs({ limit });
    if (jobs.length === 0) {
      await logCronRun({ pipeline: "audio", processed: 0, failed: 0, estimatedCostUsd: 0 });
      return NextResponse.json({ processed: 0, failed: 0, results: [] });
    }

    const results = [];
    let estimatedCostUsd = 0;
    let stoppedReason: string | null = null;
    for (const job of jobs) {
      const jobCostUsd = Number(job.estimatedCostUsd ?? 0);
      if (estimatedCostUsd + jobCostUsd > costThresholdUsd) {
        stoppedReason = "cost_threshold_exceeded";
        await releaseClaimedAudioJobs(jobs.slice(results.length).map((pendingJob) => pendingJob.id));
        break;
      }
      const result = await processAudioJob(job.id);
      estimatedCostUsd += jobCostUsd;
      results.push(result);
      const processedSoFar = results.filter((r) => r.status === "GENERATED").length;
      const failedSoFar = results.filter((r) => r.status === "FAILED").length;
      if (shouldStopForFailureRate(processedSoFar, failedSoFar)) {
        stoppedReason = "failure_rate_exceeded";
        await releaseClaimedAudioJobs(jobs.slice(results.length).map((pendingJob) => pendingJob.id));
        break;
      }
    }

    const processed = results.filter((r) => r.status === "GENERATED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;

    await logCronRun({ pipeline: "audio", processed, failed, stoppedReason, estimatedCostUsd });

    return NextResponse.json({ processed, failed, stoppedReason, estimatedCostUsd, results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Cron audio processing failed" },
      { status: 500 }
    );
  }
}
