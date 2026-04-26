import { NextResponse } from "next/server";
import { z } from "zod";
import { createSchoolEnrollmentRequest, LIBERIAN_COUNTIES } from "@/lib/school-operations";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const EnrollmentSchema = z.object({
  schoolName: z.string().trim().min(2),
  county: z.enum(LIBERIAN_COUNTIES),
  district: z.string().trim().min(2),
  schoolType: z.enum(["Public", "Private", "Mission", "Community"]),
  principalFullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7),
  estimatedStudentEnrollment: z.coerce.number().int().min(1).max(100000),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await checkRateLimit(ip, { ...RATE_LIMIT_POLICIES.AUTH, namespace: "enrollment" });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many enrollment attempts. Try again in an hour." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = EnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await createSchoolEnrollmentRequest(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Enrollment failed" }, { status });
  }
}
