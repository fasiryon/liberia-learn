import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// The sidebar links here; the leaderboard itself is per class, so send the
// student to their own class board (enrollment-checked again by the API).
export default async function StudentLeaderboardIndexPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/");

  const enrollment = await prisma.enrollment.findFirst({
    where: { Student: { userId: user.id }, Class: { schoolId: user.schoolId ?? undefined } },
    orderBy: { id: "asc" },
    select: { classId: true },
  });

  if (enrollment) redirect(`/student/leaderboard/${enrollment.classId}`);

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-[var(--ll-text)]">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
        You are not in a class yet, so there is no class leaderboard to show. Ask your teacher to add you to a class.
      </p>
      <Link href="/student/today" className="mt-4 inline-block text-sm text-[var(--ll-yellow)] hover:underline">
        Back to today
      </Link>
    </main>
  );
}
