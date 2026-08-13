import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { getCurriculumProvenanceExplanation } from "@/lib/curriculum/provenance/reader";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } },
) {
  const user = await requireUser();
  assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);
  const result = await getCurriculumProvenanceExplanation(params.contentId);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
