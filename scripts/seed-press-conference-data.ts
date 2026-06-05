/**
 * REMOVE BEFORE GENUINE NATIONAL ROLLOUT.
 * Simulated data for press demo / VSL recording only.
 *
 * Usage:
 *   PRESS_DEMO_MODE=true npx dotenv -e .env.production -- npx tsx scripts/seed-press-conference-data.ts
 *
 * Teardown:
 *   PRESS_DEMO_MODE=true npx dotenv -e .env.production -- npx tsx scripts/seed-press-conference-data.ts --teardown
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const STATE_FILE = path.join(__dirname, "data", "press-demo-ids.json");

const DEMO_TAG = "[DEMO]";
const COUNTIES = [
  "Montserrado",
  "Nimba",
  "Bong",
  "Lofa",
  "Grand Bassa",
  "Margibi",
];

// Liberian name pools for realistic demo data
const FIRST_NAMES = [
  "Pewu", "Yanquoi", "Korto", "Fatu", "Boakai", "Varney", "Satta",
  "Flomo", "Mulbah", "Gbesay", "Wesseh", "Zoe", "Nyenkan", "Tokpa",
  "Konneh", "Kollie", "Kpoto", "Sirleaf", "Togba", "Nyenabo",
];
const LAST_NAMES = [
  "Wleh", "Freeman", "Gbowee", "Flomo", "Kollie", "Toe", "Kanneh",
  "Kamara", "Konneh", "Nimely", "Lartey", "Massaquoi", "Belleh",
];
const SCHOOL_NAMES: Record<string, string[]> = {
  Montserrado: ["Capitol Hill Academy", "Tubman High School", "Stella Maris Polytechnic"],
  Nimba: ["Sanniquellie Central School", "Ganta United School"],
  Bong: ["Phebe Hospital School", "Gbarnga Central High"],
  Lofa: ["Voinjama Public School", "Kolahun District School"],
  "Grand Bassa": ["Buchanan Central High", "Edina Community School"],
  Margibi: ["Kakata Rural Training Institute", "Harbel High School"],
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function loadState(): Promise<{
  userIds: string[];
  studentIds: string[];
  schoolIds: string[];
  classIds: string[];
  sessionIds: string[];
  homeworkIds: string[];
  scheduledWorkIds: string[];
}> {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      userIds: [],
      studentIds: [],
      schoolIds: [],
      classIds: [],
      sessionIds: [],
      homeworkIds: [],
      scheduledWorkIds: [],
    };
  }
}

async function saveState(state: ReturnType<typeof loadState> extends Promise<infer T> ? T : never) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function teardown() {
  console.log("Tearing down press demo data...");
  const state = await loadState();

  // Delete in dependency order
  if (state.sessionIds.length > 0) {
    await prisma.studentSession.deleteMany({ where: { id: { in: state.sessionIds } } });
    console.log(`  Deleted ${state.sessionIds.length} sessions`);
  }
  if (state.homeworkIds.length > 0) {
    await prisma.homeworkSubmission.deleteMany({ where: { id: { in: state.homeworkIds } } });
    console.log(`  Deleted ${state.homeworkIds.length} homework submissions`);
  }
  if (state.scheduledWorkIds.length > 0) {
    await prisma.scheduledWork.deleteMany({ where: { id: { in: state.scheduledWorkIds } } });
    console.log(`  Deleted ${state.scheduledWorkIds.length} scheduled works`);
  }
  if (state.classIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { classId: { in: state.classIds } } });
    await prisma.class.deleteMany({ where: { id: { in: state.classIds } } });
    console.log(`  Deleted ${state.classIds.length} classes`);
  }
  if (state.studentIds.length > 0) {
    await prisma.student.deleteMany({ where: { id: { in: state.studentIds } } });
    console.log(`  Deleted ${state.studentIds.length} students`);
  }
  if (state.userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: state.userIds } } });
    console.log(`  Deleted ${state.userIds.length} users`);
  }
  if (state.schoolIds.length > 0) {
    await prisma.school.deleteMany({ where: { id: { in: state.schoolIds } } });
    console.log(`  Deleted ${state.schoolIds.length} schools`);
  }

  // Remove state file
  try { fs.unlinkSync(STATE_FILE); } catch { /* already gone */ }
  console.log("Teardown complete.");
}

async function seed() {
  console.log("Seeding press conference demo data...");

  // Check idempotency
  const existing = await loadState();
  if (existing.schoolIds.length > 0) {
    console.log("Press demo data already exists. Run with --teardown first to re-seed.");
    return;
  }

  // Find a real curriculum content to reference for ScheduledWork
  const content = await prisma.curriculumContent.findFirst({
    where: { status: { in: ["APPROVED", "published"] } },
    select: { contentId: true },
  });
  if (!content) {
    console.error("No approved content found. Skipping scheduled work creation.");
  }

  // Find or create a demo teacher user for createdById
  const demoTeacher = await prisma.user.upsert({
    where: { email: `demo-teacher@${DEMO_TAG.toLowerCase().replace(/[\[\]]/g, "")}.liberia.edu` },
    create: {
      email: `demo-teacher@demo.liberia.edu`,
      name: `${DEMO_TAG} Demo Teacher`,
      role: "TEACHER",
      hashedPwd: "demo-only",
    },
    update: {},
  });

  const state: Awaited<ReturnType<typeof loadState>> = {
    userIds: [demoTeacher.id],
    studentIds: [],
    schoolIds: [],
    classIds: [],
    sessionIds: [],
    homeworkIds: [],
    scheduledWorkIds: [],
  };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  // Create schools + classes per county
  for (const county of COUNTIES) {
    const schoolNamesForCounty = SCHOOL_NAMES[county] ?? [`${DEMO_TAG} ${county} School`];
    for (const schoolName of schoolNamesForCounty) {
      const school = await prisma.school.create({
        data: {
          name: `${DEMO_TAG} ${schoolName}`,
          county,
          status: "ACTIVE",
          timezone: "Africa/Monrovia",
        },
      });
      state.schoolIds.push(school.id);

      // Create 2 classes per school
      for (let g = 7; g <= 8; g++) {
        const cls = await prisma.class.create({
          data: {
            schoolId: school.id,
            name: `Grade ${g}A`,
            subject: "MATH",
            gradeLevel: g,
            teacherId: demoTeacher.id,
          },
        });
        state.classIds.push(cls.id);

        // Create scheduled work for today (delivered)
        if (content) {
          const deliveredCount = randomInt(8, 15);
          const totalCount = randomInt(deliveredCount, deliveredCount + 5);
          for (let i = 0; i < totalCount; i++) {
            const sw = await prisma.scheduledWork.create({
              data: {
                contentId: content.contentId,
                classId: cls.id,
                scheduledDate: startOfDay,
                createdById: demoTeacher.id,
                isDelivered: i < deliveredCount,
                deliveredAt: i < deliveredCount ? new Date(startOfDay.getTime() + i * 3_600_000) : null,
              },
            });
            state.scheduledWorkIds.push(sw.id);
          }
        }
      }
    }
  }

  // Create 80 demo students distributed across counties
  const studentCount = 80;
  const classIdsForEnrollment = state.classIds;

  for (let i = 0; i < studentCount; i++) {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);
    const idx = String(i).padStart(3, "0");

    const user = await prisma.user.create({
      data: {
        email: `${DEMO_TAG.toLowerCase().replace(/[\[\]]/g, "")}.student.${idx}@demo.liberia.edu`,
        name: `${firstName} ${lastName}`,
        role: "STUDENT",
        hashedPwd: "demo-only",
      },
    });
    state.userIds.push(user.id);

    const grade = randomInt(7, 8);
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        currentGrade: grade,
      },
    });
    state.studentIds.push(student.id);

    // Enroll in a random class
    const classId = randomFrom(classIdsForEnrollment);
    await prisma.enrollment.create({
      data: { studentId: student.id, classId },
    });

    // Create 0–2 sessions today (for "active now" and "lessons opened" metrics)
    const sessionCount = Math.random() < 0.65 ? randomInt(1, 3) : 0;
    for (let s = 0; s < sessionCount; s++) {
      // Most sessions are within last 5 min for demo "active now" visual
      const minsAgo = s === 0 && Math.random() < 0.7 ? randomInt(0, 4) : randomInt(5, 60);
      const startedAt = new Date(now.getTime() - minsAgo * 60_000);
      const scheduledWorkId = content
        ? randomFrom(state.scheduledWorkIds)
        : `demo-lesson-${i}-${s}`;

      const session = await prisma.studentSession.create({
        data: {
          studentId: student.id,
          lessonId: scheduledWorkId,
          startedAt,
          questionsAttempted: randomInt(0, 10),
          questionsCorrect: randomInt(0, 8),
        },
      });
      state.sessionIds.push(session.id);
    }

    // Create 0–1 homework submissions today
    if (Math.random() < 0.5 && state.classIds.length > 0) {
      // Find a homework record or skip if none
      const hw = await prisma.homework.findFirst({
        where: { classId: { in: state.classIds } },
        select: { id: true },
      });
      if (hw) {
        try {
          const sub = await prisma.homeworkSubmission.create({
            data: {
              studentId: student.id,
              homeworkId: hw.id,
              submittedAt: new Date(now.getTime() - randomInt(1, 120) * 60_000),
              answers: { demo: true },
            },
          });
          state.homeworkIds.push(sub.id);
        } catch {
          // Skip if unique constraint or other issue
        }
      }
    }
  }

  await saveState(state);

  console.log(`
Press demo seed complete:
  Schools:  ${state.schoolIds.length} (across ${COUNTIES.length} counties)
  Classes:  ${state.classIds.length}
  Students: ${state.studentIds.length}
  Sessions: ${state.sessionIds.length}
  Scheduled work: ${state.scheduledWorkIds.length}
  Homework subs: ${state.homeworkIds.length}

Run teardown: npx tsx scripts/seed-press-conference-data.ts --teardown
  `);
}

async function main() {
  if (process.env.PRESS_DEMO_MODE !== "true") {
    console.error("Set PRESS_DEMO_MODE=true to run this script.");
    process.exit(1);
  }

  const isTeardown = process.argv.includes("--teardown");
  if (isTeardown) {
    await teardown();
  } else {
    await seed();
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
