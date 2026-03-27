import { NextResponse } from "next/server";
import {
  AssistantActionRequestSchema,
  assertRole,
  buildStudyPlanDraft,
} from "@/lib/ai/rag/actionDrafts";
import { resolveAssistantAudienceScope } from "@/lib/ai/rag/audienceScope";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertRole(user, ["GUARDIAN"]);
    const body = AssistantActionRequestSchema.parse(await req.json());
    const audienceScope = await resolveAssistantAudienceScope(user, {
      subject: body.subject ?? null,
      gradeLevel: body.gradeLevel ?? null,
    });

    return NextResponse.json({
      ok: true,
      draft: buildStudyPlanDraft({
        ...body,
        subject: audienceScope.subject,
        gradeLevel: audienceScope.gradeLevel,
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to build study plan draft" },
      { status: error?.status ?? 500 }
    );
  }
}
