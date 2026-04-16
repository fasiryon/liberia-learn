import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { uploadSchoolLogoToSupabase } from "@/lib/supabaseStorage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("logo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Logo file required" }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return NextResponse.json({ error: "Logo must be 2MB or smaller" }, { status: 400 });
    }

    const logoUrl = await uploadSchoolLogoToSupabase({ schoolId: user.schoolId, file });
    await prisma.school.update({
      where: { id: user.schoolId },
      data: { logoUrl },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "school.logo.uploaded",
      resourceType: "school",
      resourceId: user.schoolId,
    });

    return NextResponse.json({ ok: true, logoUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Upload failed" }, { status: err?.status ?? 500 });
  }
}
