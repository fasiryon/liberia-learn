import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWaecEligible } from "@/lib/waec/eligibility";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
  if (!session?.user?.id) return NextResponse.json({ eligible: false });
  const student = await prisma.student.findFirst({
    where: { userId: session.user.id },
    select: { currentGrade: true },
  });
  return NextResponse.json({ eligible: isWaecEligible(student?.currentGrade), grade: student?.currentGrade ?? null });
}
