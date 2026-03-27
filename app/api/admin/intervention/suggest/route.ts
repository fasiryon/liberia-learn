import { NextResponse } from "next/server";
import {
  AssistantActionRequestSchema,
  assertRole,
  buildInterventionDraft,
} from "@/lib/ai/rag/actionDrafts";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    assertRole(user, ["ADMIN", "MOE_OFFICIAL"]);
    const body = AssistantActionRequestSchema.parse(await req.json());

    return NextResponse.json({
      ok: true,
      draft: buildInterventionDraft(body),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to suggest intervention draft" },
      { status: error?.status ?? 500 }
    );
  }
}
