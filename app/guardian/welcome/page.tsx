import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GuardianWelcomeClient from "@/app/guardian/welcome/GuardianWelcomeClient";

export const dynamic = "force-dynamic";

export default async function GuardianWelcomePage() {
  const user = await requireRole("GUARDIAN");
  const firstLink = await prisma.studentGuardian.findFirst({
    where: { guardianId: user.id },
    orderBy: { id: "asc" },
    select: {
      student: {
        select: {
          user: {
            select: { name: true },
          },
        },
      },
    },
  });

  return (
    <GuardianWelcomeClient
      guardianName={user.name ?? "Guardian"}
      childName={firstLink?.student.user.name ?? "your child"}
    />
  );
}
