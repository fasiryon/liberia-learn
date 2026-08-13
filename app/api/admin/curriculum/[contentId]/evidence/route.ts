import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { appendCurriculumEvidence } from "@/lib/curriculum/mutations/evidenceWriter";

const EvidenceSchema = z.object({
  revisionId: z.string().min(1),
  evidenceType: z.enum([
    "URL",
    "DOCUMENT",
    "CURRICULUM_STANDARD",
    "TEXTBOOK",
    "REVIEWER_NOTE",
    "EXTERNAL_REFERENCE",
  ]),
  evidencePurpose: z.enum([
    "FACTUAL_SUPPORT",
    "CURRICULUM_AUTHORITY",
    "SOURCE_MATERIAL",
    "IMPORT_ORIGIN",
    "REVIEW_SUPPORT",
  ]),
  title: z.string().trim().min(1).max(300),
  uri: z.string().url().max(4000).optional(),
  documentRef: z.string().trim().min(1).max(500).optional(),
  citation: z.string().trim().min(1).max(4000).optional(),
  publisher: z.string().trim().min(1).max(300).optional(),
  locator: z.string().trim().min(1).max(300).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  license: z.string().trim().min(1).max(300).optional(),
  status: z.enum(["ACTIVE", "WITHDRAWN"]).default("ACTIVE"),
  supersedesEvidenceId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(300),
});

export async function POST(
  req: Request,
  { params }: { params: { contentId: string } },
) {
  const user = await requireUser();
  assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE);
  const body = EvidenceSchema.parse(await req.json());
  const evidence = await appendCurriculumEvidence({
    ...body,
    contentId: params.contentId,
    addedByUserId: user.id,
    schoolId: user.schoolId ?? null,
  });
  return NextResponse.json({ contentId: params.contentId, evidence }, { status: 201 });
}
