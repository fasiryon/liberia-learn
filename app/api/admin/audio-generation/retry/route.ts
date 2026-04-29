import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { retryFailedJobs } from "@/lib/audio/audioGenerationQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const { grade, subject, limit } = body ?? {};

    const result = await retryFailedJobs({
      grade: grade ? Number(grade) : undefined,
      subject: subject ? String(subject) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Retry failed" },
      { status: error?.status ?? 500 }
    );
  }
}
