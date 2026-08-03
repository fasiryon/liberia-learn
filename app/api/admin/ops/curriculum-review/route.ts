import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { listCurriculumDrafts, reviewCurriculumDraft } from "@/lib/curriculum/regenerationAdmin";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  action: z.enum(["approve", "needs_review", "reject", "bulk_approve"]),
  contentId: z.string().min(1).optional(),
  contentIds: z.array(z.string().min(1)).max(100).optional(),
  reason: z.string().max(1000).optional(),
});

function numberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);
    const url = new URL(req.url);
    const drafts = await listCurriculumDrafts({
      grade: numberParam(url.searchParams.get("grade")),
      subject: url.searchParams.get("subject") ?? undefined,
      status: url.searchParams.get("status") ?? "DRAFT",
      limit: numberParam(url.searchParams.get("limit")),
    });
    return NextResponse.json({ drafts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.status === 403 ? "Forbidden" : err?.message ?? "Unauthorized" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser();
    assertPermission(actor, PERMISSIONS.CURRICULUM_APPROVE);
    const parsed = PostSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }
    const result = await reviewCurriculumDraft({ ...parsed.data, actor });
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.status === 403 ? "Forbidden" : err?.message ?? "Review action failed" },
      { status: err?.status ?? 500 }
    );
  }
}

