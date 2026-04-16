import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createStudentImportBatch } from "@/lib/school-operations";

export const dynamic = "force-dynamic";

const RowSchema = z.object({
  rowNumber: z.number().int().min(2),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  grade: z.coerce.number().int().min(1).max(12),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guardianPhone: z.string().optional().nullable(),
});

const ImportSchema = z.object({
  fileName: z.string().optional(),
  rows: z.array(RowSchema).min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const parsed = ImportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = await createStudentImportBatch({
      actorUserId: user.id,
      schoolId: user.schoolId,
      fileName: parsed.data.fileName,
      rows: parsed.data.rows,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Import failed" }, { status: err?.status ?? 500 });
  }
}
