import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { createReviewerCredential } from "@/lib/curriculum/review/roster";

const Scope = z.object({
  subject: z.string().max(200).nullable().optional(),
  gradeMin: z.number().int().min(1).max(12).nullable().optional(),
  gradeMax: z.number().int().min(1).max(12).nullable().optional(),
  domains: z.array(z.string().max(200)).max(50).optional(),
  curriculumScopes: z.array(z.enum(["SCHOOL", "NATIONAL", "WAEC", "IMPORTED", "LICENSED_SOURCE"])).max(10).optional(),
  curriculumTypes: z.array(z.string().max(200)).max(50).optional(),
  schoolId: z.string().nullable().optional(),
  county: z.string().max(200).nullable().optional(),
  standardRefs: z.array(z.string().max(300)).max(100).optional(),
  language: z.string().max(100).nullable().optional(),
});
const Body = z.object({
  reviewerProfileId: z.string().min(1),
  credentialType: z.enum(["SUBJECT_REVIEW", "STANDARDS_ALIGNMENT", "ACCESSIBILITY_REVIEW", "SAFETY_REVIEW", "HEALTH_REVIEW", "LEGAL_REVIEW", "WAEC_SUBJECT_REVIEW", "LICENSED_SOURCE_REVIEW", "SOURCE_RIGHTS_VERIFICATION"]),
  issuer: z.string().trim().min(1).max(300),
  authority: z.enum(["MOE", "SCHOOL", "PLATFORM"]),
  validFrom: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  evidenceRef: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  supersedesCredentialId: z.string().nullable().optional(),
  scopes: z.array(Scope).min(1).max(100),
  idempotencyKey: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const profileId = new URL(req.url).searchParams.get("reviewerProfileId");
    const profile = profileId ? await prisma.reviewerProfile.findUnique({ where: { id: profileId } }) : null;
    if (!user.isPlatformAdmin && user.role !== "MOE_SUPER_ADMIN" && (!profile || user.role !== "ADMIN" || profile.schoolId !== user.schoolId)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ credentials: await prisma.reviewerCredential.findMany({ where: profileId ? { reviewerProfileId: profileId } : {}, include: { scopes: true, statusEvents: true }, orderBy: { createdAt: "desc" } }) });
  } catch (error) { return reviewApiError(error); }
}

export async function POST(req: Request) {
  try {
    requireP2bEnabled();
    const operator = await requireUser();
    const body = Body.parse(await req.json());
    return Response.json({ credential: await createReviewerCredential({ ...body, operator, idempotencyKey: requireIdempotencyKey(req, body) }) }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
