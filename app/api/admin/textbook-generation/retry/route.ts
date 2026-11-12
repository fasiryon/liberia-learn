// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=global content and cost operations require a canonical platform ADMIN before domain work
import { NextResponse } from "next/server";
import { requirePlatformContentAdmin } from "@/lib/auth/platformContentAuthority";
import { retryFailed } from "@/lib/textbooks/textbookGenerationQueue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requirePlatformContentAdmin();
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
