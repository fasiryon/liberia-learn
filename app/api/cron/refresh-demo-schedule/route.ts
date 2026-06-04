import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEMO_CLASS_IDS = [
  "class_mca_7a",
  "class_mca_8b",
  "class_pcs_6a",
  "class_pcs_9a",
  "class_krs_5a",
  "class_krs_10a",
  "cha-class-grade9a",
];

// ID for the CHA multimedia demo lesson — always pinned to today
const CHA_DEMO_SW_ID = "cha-demo-student1-multimedia-lesson";

function getThisWeekDates(): Date[] {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekDates = getThisWeekDates(); // [0]=Mon … [4]=Fri
  const today = weekDates[0]; // fallback for weekend dates

  const scheduledWorks = await prisma.scheduledWork.findMany({
    where: { classId: { in: DEMO_CLASS_IDS } },
    select: { id: true, scheduledDate: true },
  });

  let updated = 0;
  for (const sw of scheduledWorks) {
    if (sw.id === CHA_DEMO_SW_ID) continue; // handled separately below
    const utcDay = sw.scheduledDate.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
    // Map Mon-Fri → weekDates[0-4]; weekends fall back to Monday
    const idx = utcDay === 0 || utcDay === 6 ? 0 : utcDay - 1;
    await prisma.scheduledWork.update({
      where: { id: sw.id },
      data: { scheduledDate: weekDates[idx] },
    });
    updated++;
  }

  // CHA multimedia demo lesson is always pinned to today so it shows up on any day
  await prisma.scheduledWork.updateMany({
    where: { id: CHA_DEMO_SW_ID },
    data: { scheduledDate: today },
  });

  return NextResponse.json({ updated: updated + 1, message: "Demo schedule refreshed to current week" });
}
