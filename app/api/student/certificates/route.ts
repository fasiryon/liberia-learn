import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { listStudentCertificates } from "@/lib/certificates/certificateService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const certificates = await listStudentCertificates(user.id);

    return NextResponse.json({ certificates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load certificates" },
      { status: error?.status ?? 500 }
    );
  }
}
