import { NextResponse } from "next/server";
import { claimNextTextbookJobs, processTextbookJob } from "@/lib/textbooks/textbookGenerationQueue";

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
    const limit = Math.min(12, Math.max(1, Number(body?.limit ?? 12)));
    const jobs = await claimNextTextbookJobs({ limit });
    const results = [];

    for (const job of jobs) {
      results.push(await processTextbookJob(job));
    }

    return NextResponse.json({
      processed: results.filter((result) => result.status === "GENERATED").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Cron textbook processing failed" }, { status: 500 });
  }
}
