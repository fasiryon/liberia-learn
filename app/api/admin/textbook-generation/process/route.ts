import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { claimNextTextbookJobs, processTextbookJob } from "@/lib/textbooks/textbookGenerationQueue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(2, Math.max(1, Number(body?.limit ?? 2)));
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
    return NextResponse.json({ error: error?.message ?? "Textbook processing failed" }, { status: error?.status ?? 500 });
  }
}
