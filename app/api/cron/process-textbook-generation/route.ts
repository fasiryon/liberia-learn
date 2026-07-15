import { NextResponse } from "next/server";
import { claimNextTextbookJobs, processTextbookJob, releaseClaimedTextbookJobs } from "@/lib/textbooks/textbookGenerationQueue";
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
    const limit = Math.min(2, Math.max(1, Number(body?.limit ?? 2)));
    const costThresholdUsd = getCronCostThresholdUsd("textbook");
    const jobs = await claimNextTextbookJobs({ limit });
    const results = [];
    let estimatedCostUsd = 0;
    let stoppedReason: string | null = null;

    for (const job of jobs) {
      const jobCostUsd = Number(job.estimatedCostUsd ?? 0);
      if (estimatedCostUsd + jobCostUsd > costThresholdUsd) {
        stoppedReason = "cost_threshold_exceeded";
        await releaseClaimedTextbookJobs(jobs.slice(results.length).map((pendingJob) => pendingJob.id));
        break;
      }
      results.push(await processTextbookJob(job));
      estimatedCostUsd += jobCostUsd;
      const processedSoFar = results.filter((result) => result.status === "GENERATED").length;
      const failedSoFar = results.filter((result) => result.status === "FAILED").length;
      if (shouldStopForFailureRate(processedSoFar, failedSoFar)) {
        stoppedReason = "failure_rate_exceeded";
        await releaseClaimedTextbookJobs(jobs.slice(results.length).map((pendingJob) => pendingJob.id));
        break;
      }
    }
    const processed = results.filter((result) => result.status === "GENERATED").length;
    const failed = results.filter((result) => result.status === "FAILED").length;
    await logCronRun({ pipeline: "textbook", processed, failed, stoppedReason, estimatedCostUsd });

    return NextResponse.json({
      processed,
      failed,
      stoppedReason,
      estimatedCostUsd,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Cron textbook processing failed" }, { status: 500 });
  }
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
