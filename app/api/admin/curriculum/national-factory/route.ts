import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePrivilegedStepUp, requireRole } from "@/lib/auth";
import {
  auditNationalCoverage,
  generateNationalBatch,
  buildGenerationPlan,
} from "@/lib/curriculum/nationalFactory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    await requirePrivilegedStepUp(user);
    const report = await auditNationalCoverage();
    const plan = buildGenerationPlan({});
    return NextResponse.json({
      audit: report,
      plan,
      instructions: {
        generateEndpoint: "POST /api/admin/curriculum/national-factory",
        body: {
          action: "generate | dry_run",
          grade: "number (optional)",
          subject: "string (optional)",
          batchSize: "number (optional, default 10, max 50)",
          prioritizeCritical: "boolean (optional)",
        },
      },
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const PostSchema = z.object({
  action: z.enum(["generate", "dry_run"]),
  grade: z.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),
  batchSize: z.number().int().min(1).max(50).optional(),
  prioritizeCritical: z.boolean().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    await requirePrivilegedStepUp(user);
    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }
    const { action, grade, subject, batchSize, prioritizeCritical, sessionId } = parsed.data;
    const summary = await generateNationalBatch({
      grade, subject, batchSize: batchSize ?? 10,
      dryRun: action === "dry_run",
      sessionId, prioritizeCritical: prioritizeCritical ?? false,
    });
    const postAudit = action === "generate" ? await auditNationalCoverage() : null;
    return NextResponse.json({
      ok: true, summary, postAudit,
      adminInstructions: [
        "Generated lessons are PENDING — review at /admin/curriculum",
        "Bulk approve via the Coverage Dashboard pipeline panel",
        "Re-run this endpoint to generate the next batch",
      ],
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
