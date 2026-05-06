import { PrismaClient, Subject, Weekday } from "@prisma/client";

const prisma = new PrismaClient();

const FULL_DAY_PERIODS: Array<{
  label: string;
  subject: Subject;
  displaySubject: string | null;
  start: string;
  end: string;
  order: number;
}> = [
  { label: "Period 1", subject: "MATH", displaySubject: "MATH", start: "08:00", end: "08:45", order: 1 },
  { label: "Period 2", subject: "LITERACY", displaySubject: "ENGLISH", start: "08:45", end: "09:30", order: 2 },
  { label: "Morning Break", subject: "CIVICS", displaySubject: null, start: "09:30", end: "09:45", order: 3 },
  { label: "Period 3", subject: "SCIENCE", displaySubject: "SCIENCE", start: "09:45", end: "10:30", order: 4 },
  { label: "Period 4", subject: "CIVICS", displaySubject: "SOCIAL_STUDIES", start: "10:30", end: "11:15", order: 5 },
  { label: "Period 5", subject: "CIVICS", displaySubject: "CIVICS", start: "11:15", end: "12:00", order: 6 },
  { label: "Lunch Break", subject: "CIVICS", displaySubject: null, start: "12:00", end: "13:00", order: 7 },
  { label: "Period 6", subject: "SCIENCE", displaySubject: "HEALTH", start: "13:00", end: "13:45", order: 8 },
  {
    label: "Period 7",
    subject: "COMPUTER_SCIENCE",
    displaySubject: "INFORMATION_TECHNOLOGY",
    start: "13:45",
    end: "14:30",
    order: 9,
  },
];

async function main() {
  const school = await prisma.school.findFirst({
    where: { code: "CHA" },
    select: { id: true, name: true },
  });

  if (!school) {
    console.error("CHA school not found");
    return;
  }

  const teacher = await prisma.user.findFirst({
    where: { email: "teacher1@cha.edu.lr" },
    select: { id: true },
  });

  if (!teacher) {
    console.error("teacher1@cha.edu.lr not found");
    return;
  }

  const existing = await prisma.timetable.findMany({
    where: { schoolId: school.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const classId =
    existing[0]?.classId ??
    (
      await prisma.class.findFirst({
        where: { schoolId: school.id, gradeLevel: 7 },
        select: { id: true },
      })
    )?.id;

  if (!classId) {
    console.error("CHA Grade 7 class not found");
    return;
  }

  const days =
    existing.length > 0
      ? Array.from(new Set(existing.map((entry) => entry.dayOfWeek)))
      : (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as Weekday[]);

  console.log(`Found ${existing.length} existing timetable rows`);

  await prisma.timetable.deleteMany({
    where: { schoolId: school.id, classId, dayOfWeek: { in: days } },
  });

  console.log(`Cleared timetable rows for ${days.length} days`);

  for (const day of days) {
    for (const period of FULL_DAY_PERIODS) {
      await prisma.timetable.create({
        data: {
          schoolId: school.id,
          classId,
          teacherId: teacher.id,
          dayOfWeek: day,
          periodLabel:
            period.displaySubject === null
              ? period.label
              : `${period.label} - ${period.displaySubject}`,
          subject: period.subject,
          startTime: period.start,
          endTime: period.end,
          room: `Order ${period.order}`,
        },
      });
    }
    console.log(`Seeded full day for: ${day}`);
  }

  const total = await prisma.timetable.count({
    where: { schoolId: school.id, classId, dayOfWeek: { in: days } },
  });
  console.log(`Total timetable rows now: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
