import { NextResponse } from "next/server";
import {
  AssistantActionRequestSchema,
  assertRole,
  buildLessonFixDraft,
} from "@/lib/ai/rag/actionDrafts";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertRole(user, ["TEACHER"]);
    const body = AssistantActionRequestSchema.parse(await req.json());

    return NextResponse.json({
      ok: true,
      draft: buildLessonFixDraft(body),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to improve lesson draft" },
      { status: error?.status ?? 500 }
    );
  }
}
