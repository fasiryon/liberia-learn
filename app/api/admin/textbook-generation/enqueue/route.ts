import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { enqueueTextbook } from "@/lib/textbooks/textbookGenerationQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const { grade, subject, format, force } = body ?? {};

    if (!Number.isFinite(Number(grade)) || !subject?.trim()) {
      return NextResponse.json({ error: "grade (number) and subject (string) are required." }, { status: 400 });
    }

    const result = await enqueueTextbook({
      grade: Number(grade),
      subject: String(subject),
      format: format ? String(format) as any : "student",
      force: Boolean(force),
      requestedById: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Enqueue failed" }, { status: error?.status ?? 500 });
  }
}
