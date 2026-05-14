import { prisma } from "@/lib/db";

export async function updateStreak(studentId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.studentStreak.findUnique({ where: { studentId } });

  if (existing?.lastActiveDate) {
    const last = new Date(existing.lastActiveDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
    if (diffDays === 0) return; // same day — no-op
    const newStreak = diffDays === 1 ? existing.currentStreak + 1 : 1;
    await prisma.studentStreak.update({
      where: { studentId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(existing.longestStreak, newStreak),
        lastActiveDate: today,
      },
    });
  } else {
    await prisma.studentStreak.upsert({
      where: { studentId },
      create: { studentId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
      update: { currentStreak: 1, longestStreak: 1, lastActiveDate: today },
    });
  }
}
