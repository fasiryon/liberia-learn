// prisma/seed.ts — Idempotent MOE demo seed data
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SCHEDULES } from "./seed-week-curriculum";
import { seedStrandCatalog } from "./seeds/strand-catalog";
import { seedChaDemo } from "./seeds/cha-demo";

const prisma = new PrismaClient();

/** Returns Mon-Fri dates of the current week (UTC midnight). */
function getThisWeekDates(): Date[] {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  return Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * 86400000));
}

const LOCAL_DEMO_SEED_PASSWORD = "local-demo-password-change-me";

function getDemoSeedPassword(): string {
  const password = process.env.DEMO_SEED_PASSWORD?.trim();
  if (password) return password;
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "true") {
    throw new Error("DEMO_SEED_PASSWORD is required for production/demo seed runs.");
  }
  return LOCAL_DEMO_SEED_PASSWORD;
}

const FEMALE_NAMES = [
  "Fatu", "Mary", "Grace", "Patience", "Sarah", "Jenneh", "Korto",
  "Musu", "Edith", "Comfort", "Hawa", "Bendu", "Nowai", "Kou", "Tenneh",
];
const MALE_NAMES = [
  "James", "David", "Emmanuel", "Moses", "Augustine", "Joseph",
  "Samuel", "Thomas", "Marcus", "Peter", "John", "Philip", "Daniel", "George", "Alfred",
];
const LAST_NAMES = [
  "Kollie", "Tokpah", "Sumo", "Wreh", "Karnga", "Bestman", "Pewee", "Nimely",
  "Flomo", "Mulbah", "Kpaan", "Tarr", "Gbowee", "Zinnah", "Weah", "Korkoya", "Duo", "Nagbe",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function studentName(i: number): string {
  const first = i % 2 === 0 ? pick(FEMALE_NAMES, i) : pick(MALE_NAMES, i);
  return `${first} ${pick(LAST_NAMES, i + 3)}`;
}
function studentEmail(name: string, schoolCode: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@${schoolCode}.edu.lr`;
}

async function main() {
  console.log("Seeding LiberiaLearn MOE demo data...");

  const hashed = await bcrypt.hash(getDemoSeedPassword(), 10);

  // ========== SCHOOL 1: CHA High Academy ==========
  const school1 = await prisma.school.upsert({
    where: { id: "school_mca" },
    update: {},
    create: {
      id: "school_mca",
      name: "CHA High Academy",
      code: "CHA",
      county: "Montserrado",
      district: "Greater Monrovia",
      contactName: "James Kollie",
      contactEmail: "admin@cha.edu.lr",
      contactPhone: "+231770100001",
      motto: "Excellence Through Knowledge",
      primaryHex: "#10b981",
      secondaryHex: "#8b5cf6",
      accentHex: "#10b981",
    },
  });

  // School 1 users
  const s1Admin = await prisma.user.upsert({
    where: { email: "admin@cha.edu.lr" },
    update: {},
    create: {
      email: "admin@cha.edu.lr", name: "CHA Administrator", role: "ADMIN",
      hashedPwd: hashed, schoolId: school1.id, isPlatformAdmin: false,
    },
  });

  const s1Teachers = [];
  for (const t of [
    { email: "teacher1@cha.edu.lr", name: "Mary Pewee" },
    { email: "teacher2@cha.edu.lr", name: "David Nimely" },
    { email: "teacher3@cha.edu.lr", name: "Sarah Flomo" },
  ]) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { ...t, role: "TEACHER" as const, hashedPwd: hashed, schoolId: school1.id },
    });
    s1Teachers.push(u);
  }

  // School 1 classes
  const s1c1 = await prisma.class.upsert({
    where: { id: "class_mca_7a" },
    update: {},
    create: {
      id: "class_mca_7a", name: "Grade 7A", subject: "MATH",
      teacherId: s1Teachers[0].id, schoolId: school1.id,
    },
  });
  const s1c2 = await prisma.class.upsert({
    where: { id: "class_mca_8b" },
    update: {},
    create: {
      id: "class_mca_8b", name: "Grade 8B", subject: "LITERACY",
      teacherId: s1Teachers[1].id, schoolId: school1.id,
    },
  });

  // School 1 students (30)
  const s1Students = [];
  for (let i = 0; i < 30; i++) {
    const name = studentName(i);
    const email = studentEmail(name, "cha");
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: "STUDENT" as const, hashedPwd: hashed, schoolId: school1.id },
    });
    const s = await prisma.student.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, county: "Montserrado", currentGrade: i < 15 ? 7 : 8 },
    });
    // Enroll in class
    const classId = i < 15 ? s1c1.id : s1c2.id;
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: s.id, classId } },
      update: {},
      create: { studentId: s.id, classId },
    });
    s1Students.push({ user: u, student: s, classId });
  }

  // School 1 guardian links (5)
  for (let i = 0; i < 5; i++) {
    const gName = `Guardian ${studentName(i + 50)}`;
    const gEmail = `guardian${i + 1}@cha.family.lr`;
    const guardian = await prisma.user.upsert({
      where: { email: gEmail },
      update: {},
      create: {
        email: gEmail, name: gName, role: "GUARDIAN" as const, hashedPwd: hashed,
        schoolId: school1.id, guardianPhone: `077${String(i + 1).padStart(7, "0")}`,
        guardianPhoneE164: `+231770${String(i + 100001).slice(1)}`,
        guardianCountryCode: "+231", preferredChannel: "SMS", smsOptIn: true,
      },
    });
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: s1Students[i].student.id, guardianId: guardian.id } },
      update: {},
      create: { studentId: s1Students[i].student.id, guardianId: guardian.id, relation: "Parent" },
    });
  }

  // ========== SCHOOL 2: Paynesville Community School ==========
  const school2 = await prisma.school.upsert({
    where: { id: "school_pcs" },
    update: {},
    create: {
      id: "school_pcs",
      name: "Paynesville Community School",
      code: "PCS",
      county: "Montserrado",
      district: "Paynesville",
      contactName: "Grace Tokpah",
      contactEmail: "gtokpah@pcs.edu.lr",
      contactPhone: "+231770200001",
      motto: "Learning for Life",
    },
  });

  const s2Admin = await prisma.user.upsert({
    where: { email: "gtokpah@pcs.edu.lr" },
    update: {},
    create: {
      email: "gtokpah@pcs.edu.lr", name: "Grace Tokpah", role: "ADMIN",
      hashedPwd: hashed, schoolId: school2.id,
    },
  });

  const s2Teachers = [];
  for (const t of [
    { email: "esumo@pcs.edu.lr", name: "Emmanuel Sumo" },
    { email: "pwreh@pcs.edu.lr", name: "Patience Wreh" },
  ]) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { ...t, role: "TEACHER" as const, hashedPwd: hashed, schoolId: school2.id },
    });
    s2Teachers.push(u);
  }

  const s2c1 = await prisma.class.upsert({
    where: { id: "class_pcs_6a" },
    update: {},
    create: {
      id: "class_pcs_6a", name: "Grade 6A", subject: "SCIENCE",
      teacherId: s2Teachers[0].id, schoolId: school2.id,
    },
  });
  const s2c2 = await prisma.class.upsert({
    where: { id: "class_pcs_9a" },
    update: {},
    create: {
      id: "class_pcs_9a", name: "Grade 9A", subject: "LITERACY",
      teacherId: s2Teachers[1].id, schoolId: school2.id,
    },
  });

  // School 2 students (25)
  const s2Students: Array<{ user: { id: string }; student: { id: string; currentGrade: number | null }; classId: string }> = [];
  for (let i = 0; i < 25; i++) {
    const name = studentName(i + 40);
    const email = studentEmail(name, "pcs");
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: "STUDENT" as const, hashedPwd: hashed, schoolId: school2.id },
    });
    const s = await prisma.student.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, county: "Montserrado", currentGrade: i < 13 ? 6 : 9 },
    });
    const classId = i < 13 ? s2c1.id : s2c2.id;
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: s.id, classId } },
      update: {},
      create: { studentId: s.id, classId },
    });
    s2Students.push({ user: u, student: s, classId });
  }

  // ========== SCHOOL 3: Kakata Rural School ==========
  const school3 = await prisma.school.upsert({
    where: { id: "school_krs" },
    update: {},
    create: {
      id: "school_krs",
      name: "Kakata Rural School",
      code: "KRS",
      county: "Margibi",
      district: "Kakata",
      contactName: "Moses Karnga",
      contactEmail: "mkarnga@krs.edu.lr",
      contactPhone: "+231770300001",
      allowBlueprintAdoption: true,
    },
  });

  const s3Admin = await prisma.user.upsert({
    where: { email: "mkarnga@krs.edu.lr" },
    update: {},
    create: {
      email: "mkarnga@krs.edu.lr", name: "Moses Karnga", role: "ADMIN",
      hashedPwd: hashed, schoolId: school3.id,
    },
  });

  const s3Teachers = [];
  for (const t of [
    { email: "fkollie@krs.edu.lr", name: "Fatu Kollie" },
    { email: "abestman@krs.edu.lr", name: "Augustine Bestman" },
  ]) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { ...t, role: "TEACHER" as const, hashedPwd: hashed, schoolId: school3.id },
    });
    s3Teachers.push(u);
  }

  const s3c1 = await prisma.class.upsert({
    where: { id: "class_krs_5a" },
    update: {},
    create: {
      id: "class_krs_5a", name: "Grade 5A", subject: "MATH",
      teacherId: s3Teachers[0].id, schoolId: school3.id,
    },
  });
  const s3c2 = await prisma.class.upsert({
    where: { id: "class_krs_10a" },
    update: {},
    create: {
      id: "class_krs_10a", name: "Grade 10A", subject: "SCIENCE",
      teacherId: s3Teachers[1].id, schoolId: school3.id,
    },
  });

  // School 3 students (20)
  const s3Students: Array<{ user: { id: string }; student: { id: string; currentGrade: number | null }; classId: string }> = [];
  for (let i = 0; i < 20; i++) {
    const name = studentName(i + 80);
    const email = studentEmail(name, "krs");
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: "STUDENT" as const, hashedPwd: hashed, schoolId: school3.id },
    });
    const s = await prisma.student.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, county: "Margibi", currentGrade: i < 10 ? 5 : 10 },
    });
    const classId = i < 10 ? s3c1.id : s3c2.id;
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: s.id, classId } },
      update: {},
      create: { studentId: s.id, classId },
    });
    s3Students.push({ user: u, student: s, classId });
  }

  // ========== FULL WEEK CURRICULUM CONTENT + SCHEDULED WORK ==========
  const weekDates = getThisWeekDates();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayDayIndex = weekDates.findIndex(d => d.getTime() === today.getTime());

  // Resolve teacher IDs for each schedule
  const teacherMap: Record<string, string> = {};
  for (const sched of SCHEDULES) {
    const teacher = await prisma.user.findUnique({ where: { email: sched.teacherEmail }, select: { id: true } });
    if (teacher) teacherMap[sched.teacherEmail] = teacher.id;
  }

  // Create CurriculumContent + ScheduledWork for all 130 lessons
  let contentCount = 0;
  let swCount = 0;
  for (const sched of SCHEDULES) {
    const teacherId = teacherMap[sched.teacherEmail];
    if (!teacherId) { console.warn(`Teacher not found: ${sched.teacherEmail}`); continue; }

    for (const lesson of sched.lessons) {
      // Upsert CurriculumContent
      await prisma.curriculumContent.upsert({
        where: { contentId: lesson.contentId },
        update: { payload: lesson.payload as any },
        create: {
          contentId: lesson.contentId,
          grade: lesson.grade,
          subject: lesson.subject,
          contentType: "lesson",
          status: "APPROVED",
          version: "1.0",
          payload: lesson.payload as any,
        },
      });
      contentCount++;

      // ScheduledWork with stable ID
      const swId = `sw_${sched.classId.replace("class_", "")}_${lesson.day}_p${lesson.periodNumber}`;
      const scheduledDate = weekDates[lesson.day];
      await prisma.scheduledWork.upsert({
        where: { id: swId },
        update: { periodNumber: lesson.periodNumber, startTime: lesson.startTime, endTime: lesson.endTime },
        create: {
          id: swId,
          contentId: lesson.contentId,
          classId: sched.classId,
          scheduledDate,
          periodNumber: lesson.periodNumber,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          createdById: teacherId,
        },
      });
      swCount++;
    }
  }
  console.log(`  Created ${contentCount} curriculum content records, ${swCount} scheduled work entries`);

  // ========== MEETINGS (attendance markers) ==========
  // CHA: all 5 days × 2 classes = 10, PCS: Mon-Wed × 2 = 6, KRS: Mon only × 2 = 2 → 18 total
  const meetingConfigs: { classIds: string[]; days: number[] }[] = [
    { classIds: [s1c1.id, s1c2.id], days: [0, 1, 2, 3, 4] }, // CHA all week
    { classIds: [s2c1.id, s2c2.id], days: [0, 1, 2] },        // PCS Mon-Wed
    { classIds: [s3c1.id, s3c2.id], days: [0] },               // KRS Mon only
  ];
  let meetingCount = 0;
  for (const mc of meetingConfigs) {
    for (const classId of mc.classIds) {
      for (const dayIdx of mc.days) {
        const meetId = `meet_${classId.replace("class_", "")}_d${dayIdx}`;
        const startsAt = new Date(weekDates[dayIdx].getTime() + 8 * 3600000); // 08:00
        const endsAt = new Date(weekDates[dayIdx].getTime() + 12 * 3600000);  // 12:00
        await prisma.meeting.upsert({
          where: { id: meetId },
          update: {},
          create: { id: meetId, classId, startsAt, endsAt },
        });
        meetingCount++;
      }
    }
  }
  console.log(`  Created ${meetingCount} meeting records`);

  // ========== STUDENT PROGRESS (story arc) ==========
  // CHA: 85% completion on past days, 40% on today
  // PCS: 55% on past days, 20% on today
  // KRS: 25% on past days (krs5a), 35% (krs10a), 10% on today
  const schoolStudents: { schoolCode: string; students: typeof s1Students; classes: { id: string; pct: number; todayPct: number }[] }[] = [
    { schoolCode: "mca", students: s1Students, classes: [
      { id: s1c1.id, pct: 0.85, todayPct: 0.40 },
      { id: s1c2.id, pct: 0.85, todayPct: 0.40 },
    ]},
    { schoolCode: "pcs", students: [], classes: [
      { id: s2c1.id, pct: 0.55, todayPct: 0.20 },
      { id: s2c2.id, pct: 0.55, todayPct: 0.20 },
    ]},
    { schoolCode: "krs", students: [], classes: [
      { id: s3c1.id, pct: 0.25, todayPct: 0.10 },
      { id: s3c2.id, pct: 0.35, todayPct: 0.10 },
    ]},
  ];

  let progressCount = 0;
  for (const cfg of schoolStudents) {
    for (const cls of cfg.classes) {
      // Find enrolled students for this class
      const enrollments = await prisma.enrollment.findMany({
        where: { classId: cls.id },
        select: { Student: { select: { userId: true } } },
      });
      const userIds = enrollments.map(e => e.Student.userId);

      // Find all scheduled work for this class this week
      const allSw = await prisma.scheduledWork.findMany({
        where: { classId: cls.id, scheduledDate: { gte: weekDates[0], lte: weekDates[4] } },
        select: { id: true, scheduledDate: true },
      });

      for (const sw of allSw) {
        const swDate = new Date(sw.scheduledDate);
        swDate.setUTCHours(0, 0, 0, 0);
        const isPast = swDate.getTime() < today.getTime();
        const isToday = swDate.getTime() === today.getTime();
        const pct = isPast ? cls.pct : isToday ? cls.todayPct : 0;
        const numStudents = Math.round(userIds.length * pct);

        for (let i = 0; i < numStudents && i < userIds.length; i++) {
          const completedAt = isPast ? sw.scheduledDate : null;
          const startedAt = isPast || isToday ? sw.scheduledDate : null;
          if (!startedAt) continue;
          await prisma.studentProgress.upsert({
            where: { studentId_scheduledWorkId: { studentId: userIds[i], scheduledWorkId: sw.id } },
            update: {},
            create: {
              studentId: userIds[i],
              scheduledWorkId: sw.id,
              startedAt,
              completedAt,
            },
          });
          progressCount++;
        }
      }
    }
  }
  console.log(`  Created ${progressCount} student progress records`);

  // ========== ADDITIONAL GUARDIAN LINKS (CHA needs 15 total for 50% of 30) ==========
  for (let i = 5; i < 15; i++) {
    const gName = `Guardian ${studentName(i + 50)}`;
    const gEmail = `guardian${i + 1}@cha.family.lr`;
    const guardian = await prisma.user.upsert({
      where: { email: gEmail },
      update: {},
      create: {
        email: gEmail, name: gName, role: "GUARDIAN" as const, hashedPwd: hashed,
        schoolId: school1.id, guardianPhone: `077${String(i + 1).padStart(7, "0")}`,
        guardianPhoneE164: `+231770${String(i + 100001).slice(1)}`,
        guardianCountryCode: "+231", preferredChannel: "SMS", smsOptIn: true,
      },
    });
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: s1Students[i].student.id, guardianId: guardian.id } },
      update: {},
      create: { studentId: s1Students[i].student.id, guardianId: guardian.id, relation: "Parent" },
    });
  }
  console.log("  Added 10 more CHA guardian links (15 total, 50% of 30 students)");

  // Update CHA school onboardingStep to 5
  await prisma.school.update({ where: { id: school1.id }, data: { onboardingStep: 5 } });
  console.log("  Updated CHA onboardingStep to 5");

  // ========== PLACEMENT TESTS (10 per school for demo readiness) ==========
  const placementBandForGrade = (grade: number) => {
    if (grade <= 3) return { band: "FOUNDATIONAL",  levelLabel: "Grade 1–3",   rawScore: 8,  totalQuestions: 20 };
    if (grade <= 6) return { band: "DEVELOPING",    levelLabel: "Grade 4–6",   rawScore: 11, totalQuestions: 20 };
    if (grade <= 9) return { band: "PROFICIENT",    levelLabel: "Grade 7–9",   rawScore: 15, totalQuestions: 20 };
    return           { band: "ADVANCED",      levelLabel: "Grade 10–12", rawScore: 18, totalQuestions: 20 };
  };
  const ptSchools = [
    { code: "mca", students: s1Students.slice(0, 10) },
    { code: "pcs", students: s2Students.slice(0, 10) },
    { code: "krs", students: s3Students.slice(0, 10) },
  ];
  let ptCount = 0;
  for (const { code, students } of ptSchools) {
    for (let i = 0; i < students.length; i++) {
      const grade = students[i].student.currentGrade ?? 7;
      const pb = placementBandForGrade(grade);
      await prisma.placementTest.upsert({
        where: { id: `pt_${code}_${i}` },
        update: {},
        create: {
          id: `pt_${code}_${i}`,
          studentId: students[i].student.id,
          band: pb.band,
          levelLabel: pb.levelLabel,
          estimatedGrade: grade,
          rawScore: pb.rawScore,
          totalQuestions: pb.totalQuestions,
        },
      });
      ptCount++;
    }
  }
  console.log(`  Created ${ptCount} placement test records (10 per school)`);

  // ========== PCS GUARDIAN LINKS (5 for first 5 students) ==========
  for (let i = 0; i < 5; i++) {
    const gName = `Guardian ${studentName(i + 200)}`;
    const gEmail = `guardian${i + 1}@pcs.edu.lr`;
    const guardian = await prisma.user.upsert({
      where: { email: gEmail },
      update: {},
      create: {
        email: gEmail, name: gName, role: "GUARDIAN" as const, hashedPwd: hashed,
        schoolId: school2.id, guardianPhone: `077${String(i + 100101).slice(1)}`,
        guardianPhoneE164: `+231770${String(i + 100101).slice(1)}`,
        guardianCountryCode: "+231", preferredChannel: "SMS", smsOptIn: true,
      },
    });
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: s2Students[i].student.id, guardianId: guardian.id } },
      update: {},
      create: { studentId: s2Students[i].student.id, guardianId: guardian.id, relation: "Parent" },
    });
  }
  console.log("  Added 5 PCS guardian links");

  // ========== KRS GUARDIAN LINKS (4 for first 4 students) ==========
  for (let i = 0; i < 4; i++) {
    const gName = `Guardian ${studentName(i + 300)}`;
    const gEmail = `guardian${i + 1}@krs.edu.lr`;
    const guardian = await prisma.user.upsert({
      where: { email: gEmail },
      update: {},
      create: {
        email: gEmail, name: gName, role: "GUARDIAN" as const, hashedPwd: hashed,
        schoolId: school3.id, guardianPhone: `077${String(i + 100201).slice(1)}`,
        guardianPhoneE164: `+231770${String(i + 100201).slice(1)}`,
        guardianCountryCode: "+231", preferredChannel: "SMS", smsOptIn: true,
      },
    });
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: s3Students[i].student.id, guardianId: guardian.id } },
      update: {},
      create: { studentId: s3Students[i].student.id, guardianId: guardian.id, relation: "Parent" },
    });
  }
  console.log("  Added 4 KRS guardian links");

  // Canonical demo identities are seeded via prisma/seeds/cha-demo.ts.

  // ========== WEEKLY SCHEDULE SUMMARY ==========
  console.log("\n=== Weekly Schedule Summary ===");
  for (const sched of SCHEDULES) {
    console.log(`\n${sched.classId}:`);
    for (let d = 0; d < 5; d++) {
      const dayLessons = sched.lessons.filter(l => l.day === d);
      const dateStr = weekDates[d].toISOString().slice(0, 10);
      const lessonList = dayLessons.map(l => `P${l.periodNumber}:${l.subject}`).join(", ");
      console.log(`  ${dayNames[d]} ${dateStr}: ${lessonList} (${dayLessons.length} periods)`);
    }
  }

  // ── Block 7A: Strand Catalog ──────────────────────────────────────────────
  console.log("\nSeeding strand catalog (Block 7A — Mastery Engine)...");
  await seedStrandCatalog();

  // ── CHA Demo Accounts ─────────────────────────────────────────────────────
  console.log("\nSeeding CHA demo accounts...");
  await seedChaDemo();

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
