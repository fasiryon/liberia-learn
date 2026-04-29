import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { retryFailed } from "@/lib/textbooks/textbookGenerationQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const result = await retryFailed({
      grade: body?.grade ? Number(body.grade) : undefined,
      subject: body?.subject ? String(body.subject) : undefined,
      format: body?.format ? String(body.format) : undefined,
      limit: body?.limit ? Number(body.limit) : undefined,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Retry failed" }, { status: error?.status ?? 500 });
  }
}
