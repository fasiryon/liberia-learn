import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import { createReviewerProfile } from "@/lib/curriculum/review/roster";

const Body = z.object({
  userId: z.string().min(1),
  organizationType: z.enum(["SCHOOL", "MOE", "PLATFORM", "SPECIALIST"]),
  authority: z.enum(["MOE", "SCHOOL", "PLATFORM"]),
  schoolId: z.string().nullable().optional(),
  organizationName: z.string().max(300).nullable().optional(),
  tier: z.number().int().min(1).max(10).optional(),
  languages: z.array(z.string().min(1).max(100)).max(20).optional(),
  idempotencyKey: z.string().optional(),
});

export async function GET() {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    assertReviewOperationsAdmin(user, user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN" ? null : user.schoolId);
    return Response.json({ reviewers: await prisma.reviewerProfile.findMany({
      where: user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN" ? {} : { schoolId: user.schoolId ?? "__none__" },
      include: { user: { select: { id: true, name: true, email: true, role: true, schoolId: true } }, credentials: { include: { scopes: true, statusEvents: true } }, restrictions: true },
      orderBy: { createdAt: "desc" },
    }) });
  } catch (error) { return reviewApiError(error); }
}

export async function POST(req: Request) {
  try {
    requireP2bEnabled();
    const operator = await requireUser();
    const body = Body.parse(await req.json());
    assertReviewOperationsAdmin(operator, body.schoolId);
    return Response.json({ reviewer: await createReviewerProfile({ ...body, operator, idempotencyKey: requireIdempotencyKey(req, body) }) }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
