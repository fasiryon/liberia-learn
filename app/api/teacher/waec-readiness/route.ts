import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTeacherWaecReadiness } from "@/lib/waec/aggregate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER" && user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = await getTeacherWaecReadiness(user.id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: e?.status ?? 500 });
  }
}
