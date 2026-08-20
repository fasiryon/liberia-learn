import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getCurriculumProvenanceExplanation } from "@/lib/curriculum/provenance/reader";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } },
) {
  await requireRole("MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN");
  const result = await getCurriculumProvenanceExplanation(params.contentId);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
