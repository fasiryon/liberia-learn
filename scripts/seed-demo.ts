/**
 * scripts/seed-demo.ts
 *
 * National Scale Demo Seed — LiberiaLearn
 * 10 Schools · 3 Districts · ~300 Students · Full Workflow Data
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-demo.ts
 *   or via package.json: npm run seed:demo
 *
 * Safety:
 *   - BLOCKED in production (NODE_ENV=production)
 *   - Idempotent: second run exits cleanly after detecting existing data
 *   - All seeded passwords are development-only: "DemoSeed2026!"
 *   - MOE accounts: official1@moe.gov.lr / official2@moe.gov.lr / Password: "MOESeed2026!"
 *
 * Feature flags needed to see full demo data:
 *   ENABLE_GUARDIAN_DASHBOARD=true
 *   ENABLE_GUARDIAN_PORTAL=true
 *   ENABLE_MOE_LOGIN_PORTAL=true
 *   ENABLE_MOE_PORTAL=true
 *   NEXT_PUBLIC_ENABLE_AI_TUTOR=true
 *
 * DO NOT run in CI. This is a manual demo-environment script only.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

let prisma = new PrismaClient();

type DemoSeedLogger = Pick<Console, "log" | "error">;

type SeedNationalDemoOptions = {
  prisma?: PrismaClient;
  schoolIds?: readonly string[];
  allowExisting?: boolean;
  allowProduction?: boolean;
  logger?: DemoSeedLogger;
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE EXPORTED FUNCTIONS (testable without DB)
// ─────────────────────────────────────────────────────────────────────────────

const MALE_FIRST = [
  "Pewu", "Tokpah", "Gbanyan", "Karmo", "Flomo", "Saye", "Boima", "Zinnah",
  "Mulbah", "Kpaan", "Varney", "Gongloe", "Tamba", "Nyumah", "Kollie", "Sumo",
  "Pewee", "Gbondo", "Moses", "Emmanuel", "Joseph", "Samuel", "Thomas",
];
const FEMALE_FIRST = [
  "Korto", "Finda", "Yeanoh", "Kumba", "Tenneh", "Mammah", "Korpo", "Musu",
  "Yatta", "Gbassay", "Nowai", "Flumo", "Gormah", "Deddeh", "Watta",
  "Nyankor", "Kesselly", "Grace", "Patience", "Hawa", "Bendu",
];
const SURNAMES = [
  "Flomo", "Kollie", "Tokpah", "Mulbah", "Sumo", "Gongloe", "Pewu", "Zinnah",
  "Karmo", "Boakai", "Kpaan", "Nimely", "Varney", "Tamba", "Gbondo", "Saye",
  "Nyumah", "Cooper", "Johnson", "Freeman", "Weah", "Sirleaf", "Brumskine",
  "Sherman", "Wreh", "Nagbe", "Duo", "Bestman",
];

function pick<T>(arr: T[], i: number): T {
  return arr[Math.abs(i) % arr.length];
}

/** Generates a realistic Liberian student name deterministically from index. */
export function generateStudentName(index: number): string {
  const isFemale = (index * 3 + 1) % 2 === 0;
  const first = isFemale ? pick(FEMALE_FIRST, index) : pick(MALE_FIRST, index);
  const last = pick(SURNAMES, index + 5);
  return `${first} ${last}`;
}

/** Generates a realistic Liberian guardian name deterministically from index. */
export function generateGuardianName(index: number): string {
  const isFemale = index % 2 === 0;
  const first = isFemale ? pick(FEMALE_FIRST, index + 10) : pick(MALE_FIRST, index + 8);
  const last = pick(SURNAMES, index + 14);
  return `${first} ${last}`;
}

/**
 * Returns a mastery level (0-5) based on deterministic hashing.
 *
 * Distribution (matches MOE spec):
 *   15% at-risk    → levels 0-1
 *   60% developing → levels 2-3
 *   25% proficient → levels 4-5
 *
 * Upper grades shift toward proficient.
 */
export function getMasteryLevel(
  strandIndex: number,
  studentIndex: number,
  grade: number
): number {
  // Deterministic pseudo-random in [0,99]
  const raw = (strandIndex * 17 + studentIndex * 7 + grade * 3) % 100;
  // Grade bonus: upper grades more likely to be proficient
  const gradeFactor = Math.min(grade - 1, 11) / 11; // 0 for grade 1, 1 for grade 12
  const adjusted = raw + Math.floor(gradeFactor * 12);
  const bucket = adjusted % 100;

  if (bucket < 15) return bucket % 2;        // 0 or 1  — at-risk (15%)
  if (bucket < 75) return 2 + (bucket % 2);  // 2 or 3  — developing (60%)
  return 4 + (bucket % 2);                   // 4 or 5  — proficient (25%)
}

/** Converts a 0-5 mastery level to a 0.0-1.0 score for StudentMasteryProfile. */
export function getMasteryScore(level: number): number {
  const scores = [0.05, 0.2, 0.4, 0.6, 0.78, 0.95];
  return scores[Math.max(0, Math.min(level, 5))];
}

/**
 * Returns the attendance rate for a student.
 * ~15% of students get 70-80% attendance; the rest get 85-95%.
 */
export function studentAttendanceRate(
  studentIndex: number,
  totalStudents: number
): number {
  // Every 7th student (≈14.3%) gets lower attendance
  if (studentIndex % 7 === 0) {
    // 70-80% band
    return 0.70 + (((studentIndex * 13) % 11) / 100);
  }
  // 85-95% band
  return 0.85 + (((studentIndex * 11) % 11) / 100);
}

/**
 * Given a day index (0=oldest) and target attendance rate, returns status.
 * Uses deterministic logic to hit the target rate approximately.
 */
export function getAttendanceStatus(
  dayIndex: number,
  attendanceRate: number
): "PRESENT" | "ABSENT" | "LATE" {
  const roll = (dayIndex * 41) % 100;
  const presentThreshold = Math.round(attendanceRate * 100);
  if (roll < presentThreshold - 3) return "PRESENT";
  if (roll < presentThreshold) return "LATE";
  return "ABSENT";
}

/** Returns true if running in production. Safe to call in tests. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const DISTRICT_DEFS = [
  { id: "dist-montserrado", name: "Montserrado", region: "Greater Monrovia", code: "MONT" },
  { id: "dist-nimba",       name: "Nimba",       region: "North-East",       code: "NIMBA" },
  { id: "dist-bong",        name: "Bong",         region: "Central",          code: "BONG" },
] as const;

export const SCHOOL_DEFS = [
  // Montserrado (4)
  { id: "school-cha",  name: "Capitol Hill Academy",    county: "Montserrado", districtId: "dist-montserrado", code: "cha",  studentCount: 45 },
  { id: "school-mcs",  name: "Monrovia Central School", county: "Montserrado", districtId: "dist-montserrado", code: "mcs",  studentCount: 40 },
  { id: "school-scs",  name: "Sinkor Community School", county: "Montserrado", districtId: "dist-montserrado", code: "scs",  studentCount: 35 },
  { id: "school-cte",  name: "Congo Town Elementary",   county: "Montserrado", districtId: "dist-montserrado", code: "cte",  studentCount: 30 },
  // Nimba (3)
  { id: "school-sps",  name: "Sanniquellie Public School", county: "Nimba", districtId: "dist-nimba", code: "sps", studentCount: 30 },
  { id: "school-gua",  name: "Ganta United Academy",       county: "Nimba", districtId: "dist-nimba", code: "gua", studentCount: 30 },
  { id: "school-tds",  name: "Tappita District School",    county: "Nimba", districtId: "dist-nimba", code: "tds", studentCount: 25 },
  // Bong (3)
  { id: "school-gcs",  name: "Gbarnga Central School",  county: "Bong", districtId: "dist-bong", code: "gcs", studentCount: 35 },
  { id: "school-sra",  name: "Suakoko Rural Academy",   county: "Bong", districtId: "dist-bong", code: "sra", studentCount: 25 },
  { id: "school-sal",  name: "Salala Community School", county: "Bong", districtId: "dist-bong", code: "sal", studentCount: 25 },
] as const;

type SchoolDef = (typeof SCHOOL_DEFS)[number];

// Subjects and their label (for classes and teachers)
const CLASS_SUBJECTS = [
  { subject: "MATH" as const,             label: "Mathematics" },
  { subject: "SCIENCE" as const,          label: "Science" },
  { subject: "LITERACY" as const,         label: "English/Literacy" },
  { subject: "CIVICS" as const,           label: "Civics & Social Studies" },
  { subject: "COMPUTER_SCIENCE" as const, label: "Information Technology" },
  { subject: "SCIENCE" as const,          label: "Agriculture & Health" }, // second science teacher
];

// Demo strands used for StudentMasteryProfile (subset of full strand catalog)
const DEMO_STRANDS = [
  { subject: "MATH" as const,    strandKey: "number_sense",      name: "Number Sense",       gradeBand: "G1_3" as const },
  { subject: "MATH" as const,    strandKey: "basic_operations",  name: "Basic Operations",   gradeBand: "G1_3" as const },
  { subject: "MATH" as const,    strandKey: "fractions_decimals",name: "Fractions & Decimals",gradeBand: "G4_6" as const },
  { subject: "MATH" as const,    strandKey: "data_graphs",       name: "Data & Graphs",      gradeBand: "G4_6" as const },
  { subject: "MATH" as const,    strandKey: "algebra_basics",    name: "Algebra",            gradeBand: "G7_9" as const },
  { subject: "MATH" as const,    strandKey: "statistics_prob",   name: "Statistics",         gradeBand: "G7_9" as const },
  { subject: "SCIENCE" as const, strandKey: "living_nonliving",  name: "Living Things",      gradeBand: "G1_3" as const },
  { subject: "SCIENCE" as const, strandKey: "plants_animals",    name: "Plants & Animals",   gradeBand: "G1_3" as const },
  { subject: "SCIENCE" as const, strandKey: "ecosystems",        name: "Ecosystems",         gradeBand: "G4_6" as const },
  { subject: "SCIENCE" as const, strandKey: "forces_motion",     name: "Forces & Motion",    gradeBand: "G4_6" as const },
  { subject: "SCIENCE" as const, strandKey: "cells_biology",     name: "Cell Biology",       gradeBand: "G7_9" as const },
  { subject: "SCIENCE" as const, strandKey: "chemistry_basics",  name: "Chemistry",          gradeBand: "G7_9" as const },
];

// Returns school-day dates (Mon-Fri) going back N days from today
function schoolDaysBack(n: number): Date[] {
  const result: Date[] = [];
  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (result.length < n) {
    const dow = cursor.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) result.push(new Date(cursor));
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return result.reverse(); // oldest first
}

// Returns a random-ish school-hour timestamp (8am-4pm UTC) for a given base date
function schoolHourTs(baseDate: Date, offset: number): Date {
  const hour = 8 + (offset % 8);
  const min = (offset * 7) % 60;
  return new Date(Date.UTC(
    baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hour, min, 0
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function seedDistricts(): Promise<void> {
  for (const d of DISTRICT_DEFS) {
    await prisma.district.upsert({
      where: { id: d.id },
      update: { name: d.name },
      create: {
        id: d.id,
        tenantId: d.id,
        name: d.name,
        region: d.region,
        code: d.code,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ ${DISTRICT_DEFS.length} districts`);
}

async function seedDemoStrands(): Promise<void> {
  for (const s of DEMO_STRANDS) {
    await prisma.strandCatalog.upsert({
      where: { StrandCatalog_subject_strandKey_key: { subject: s.subject, strandKey: s.strandKey } },
      update: {},
      create: {
        subject: s.subject,
        strandKey: s.strandKey,
        name: s.name,
        gradeBand: s.gradeBand,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ ${DEMO_STRANDS.length} demo strands ensured`);
}

async function seedMoeOfficials(hashed: string): Promise<void> {
  const moeAccounts = [
    { email: "official1@moe.gov.lr", name: "Director Tokpah Gongloe" },
    { email: "official2@moe.gov.lr", name: "Coordinator Korto Sirleaf" },
  ];
  for (const m of moeAccounts) {
    await prisma.user.upsert({
      where: { email: m.email },
      update: { hashedPwd: hashed },
      create: {
        email: m.email,
        name: m.name,
        role: "MOE_OFFICIAL",
        hashedPwd: hashed,
        schoolId: null,
      },
    });
  }
  console.log(`  ✓ ${moeAccounts.length} MOE_OFFICIAL accounts`);
}

async function seedDemoCurriculumContent(): Promise<void> {
  const entries = [
    { contentId: "demo-content-math-g1_3",    grade: 2,  subject: "MATH",             title: "Number Sense Foundations" },
    { contentId: "demo-content-math-g4_6",    grade: 5,  subject: "MATH",             title: "Fractions in Context" },
    { contentId: "demo-content-math-g7_9",    grade: 8,  subject: "MATH",             title: "Algebra Basics" },
    { contentId: "demo-content-sci-g1_3",     grade: 2,  subject: "SCIENCE",          title: "Living and Non-Living Things" },
    { contentId: "demo-content-sci-g4_6",     grade: 5,  subject: "SCIENCE",          title: "Ecosystems of Liberia" },
    { contentId: "demo-content-sci-g7_9",     grade: 8,  subject: "SCIENCE",          title: "Cell Biology Fundamentals" },
    { contentId: "demo-content-lit-g1_3",     grade: 2,  subject: "LITERACY",         title: "Reading Comprehension" },
    { contentId: "demo-content-lit-g4_6",     grade: 5,  subject: "LITERACY",         title: "Persuasive Writing" },
    { contentId: "demo-content-civ-g4_6",     grade: 5,  subject: "CIVICS",           title: "Our Government" },
    { contentId: "demo-content-cs-g4_6",      grade: 5,  subject: "COMPUTER_SCIENCE", title: "Introduction to Computers" },
  ];
  for (const e of entries) {
    await prisma.curriculumContent.upsert({
      where: { contentId: e.contentId },
      update: {},
      create: {
        contentId: e.contentId,
        grade: e.grade,
        subject: e.subject,
        contentType: "lesson",
        status: "APPROVED",
        version: "1.0",
        payload: { title: e.title, objectives: [], activities: [] },
      },
    });
  }
  console.log(`  ✓ ${entries.length} curriculum content records`);
}

async function seedSchool(
  school: SchoolDef,
  hashed: string,
  hashedMoe: string,
  studentOffset: number
): Promise<{ studentCount: number; guardianCount: number }> {
  const { id: schoolId, name, county, districtId, code, studentCount: SC } = school;

  // ── School ────────────────────────────────────────────────────────────────
  await prisma.school.upsert({
    where: { id: schoolId },
    update: { name, code: code.toUpperCase() },
    create: {
      id: schoolId,
      name,
      code: code.toUpperCase(),
      county,
      district: districtId,
      districtId,
      timezone: "Africa/Monrovia",
      primaryHex: "#1e40af",
      secondaryHex: "#0ea5e9",
      status: "ACTIVE",
    },
  });

  // ── Admin ─────────────────────────────────────────────────────────────────
  const adminEmail = `admin@${code}.edu.lr`;
  const adminName = `Principal ${pick(SURNAMES, studentOffset)}`;
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { hashedPwd: hashed, schoolId },
    create: { email: adminEmail, name: adminName, role: "ADMIN", hashedPwd: hashed, schoolId },
  });

  // ── Teachers ──────────────────────────────────────────────────────────────
  const teacherIds: string[] = [];
  for (let ti = 0; ti < CLASS_SUBJECTS.length; ti++) {
    const cs = CLASS_SUBJECTS[ti];
    const tEmail = `teacher${ti + 1}@${code}.edu.lr`;
    const tName = generateStudentName(studentOffset + ti + 100);
    const teacher = await prisma.user.upsert({
      where: { email: tEmail },
      update: { hashedPwd: hashed, schoolId },
      create: { email: tEmail, name: tName, role: "TEACHER", hashedPwd: hashed, schoolId },
    });
    teacherIds.push(teacher.id);

    // Class for each teacher
    const classId = `cls-${code}-${cs.subject.toLowerCase().slice(0, 4)}-${ti}`;
    await prisma.class.upsert({
      where: { id: classId },
      update: { teacherId: teacher.id },
      create: {
        id: classId,
        schoolId,
        name: `${cs.label} — ${name.split(" ")[0]}`,
        subject: cs.subject,
        teacherId: teacher.id,
      },
    });

    // Assignments (5 per class)
    for (let ai = 0; ai < 5; ai++) {
      const assignId = `asgn-${code}-${ti}-${ai}`;
      const dueOffset = ai < 3 ? -(ai + 1) * 7 : (ai - 1) * 7; // mix past/future
      const dueAt = new Date(Date.now() + dueOffset * 86_400_000);
      await prisma.assignment.upsert({
        where: { id: assignId },
        update: {},
        create: {
          id: assignId,
          classId,
          title: `${cs.label} Assignment ${ai + 1}`,
          description: `Term assignment covering ${cs.label} topics.`,
          dueAt,
          points: 100,
        },
      });

      // Homework paired with each assignment
      const hwId = `hw-${code}-${ti}-${ai}`;
      await prisma.homework.upsert({
        where: { id: hwId },
        update: {},
        create: {
          id: hwId,
          classId,
          title: `${cs.label} Homework ${ai + 1}`,
          dueAt,
          createdById: teacher.id,
          instructions: `Complete the exercises on ${cs.label}.`,
        },
      });
    }

    // Delivered ScheduledWork (5 lessons per class in last 30 days)
    const deliveryDays = schoolDaysBack(30).slice(-5);
    const contentKey = `demo-content-${cs.subject.toLowerCase().slice(0, 3)}-g4_6`;
    const contentFallback = "demo-content-math-g4_6";
    for (let li = 0; li < deliveryDays.length; li++) {
      const swId = `sw-${code}-${ti}-${li}`;
      const deliveredAt = schoolHourTs(deliveryDays[li], li + ti);
      const resolvedContent = [
        "demo-content-math-g1_3", "demo-content-math-g4_6", "demo-content-math-g7_9",
        "demo-content-sci-g1_3", "demo-content-sci-g4_6", "demo-content-sci-g7_9",
        "demo-content-lit-g1_3", "demo-content-lit-g4_6", "demo-content-civ-g4_6",
        "demo-content-cs-g4_6",
      ].includes(contentKey) ? contentKey : contentFallback;

      await prisma.scheduledWork.upsert({
        where: { id: swId },
        update: { isDelivered: true, deliveredAt },
        create: {
          id: swId,
          contentId: resolvedContent,
          classId,
          scheduledDate: deliveryDays[li],
          createdById: teacher.id,
          isDelivered: true,
          deliveredAt,
          classFormat: "standard",
          status: "confirmed",
          completionRate: 75 + (li * 5) % 25,
        },
      });
    }
  }

  // ── Students ──────────────────────────────────────────────────────────────
  const primaryClassId = `cls-${code}-math-0`;
  const schoolDays60 = schoolDaysBack(60);
  let guardianCount = 0;

  for (let si = 0; si < SC; si++) {
    const globalIdx = studentOffset + si;
    const sName = generateStudentName(globalIdx);
    const sEmail = `student${globalIdx + 1}@${code}.edu.lr`;
    const grade = 1 + (si % 12);
    const attendanceRate = studentAttendanceRate(si, SC);

    const studentUser = await prisma.user.upsert({
      where: { email: sEmail },
      update: { hashedPwd: hashed, schoolId },
      create: { email: sEmail, name: sName, role: "STUDENT", hashedPwd: hashed, schoolId },
    });

    const student = await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: { currentGrade: grade },
      create: { userId: studentUser.id, currentGrade: grade, county },
    });

    // Enroll in primary class
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: student.id, classId: primaryClassId } },
      update: {},
      create: { studentId: student.id, classId: primaryClassId },
    });

    // ── Mastery profiles ─────────────────────────────────────────────────
    for (let mi = 0; mi < DEMO_STRANDS.length; mi++) {
      const strand = DEMO_STRANDS[mi];
      const level = getMasteryLevel(mi, globalIdx, grade);
      const score = getMasteryScore(level);
      const baseline = getMasteryScore(Math.max(0, level - 1));

      const masteryState =
        level <= 1 ? "DECAYING" :
        level <= 3 ? "DEVELOPING" :
        level === 4 ? "APPROACHING" : "MASTERED";

      const profState =
        level <= 1 ? "BELOW_PROFICIENT" :
        level <= 3 ? "APPROACHING" : "PROFICIENT";

      await prisma.studentMasteryProfile.upsert({
        where: {
          StudentMasteryProfile_studentId_subject_strandKey_key: {
            studentId: student.id,
            subject: strand.subject,
            strandKey: strand.strandKey,
          },
        },
        update: { currentScore: score, masteryState, proficiencyState: profState },
        create: {
          studentId: student.id,
          subject: strand.subject,
          strandKey: strand.strandKey,
          baselineScore: baseline,
          currentScore: score,
          masteryState,
          proficiencyState: profState,
          sustainabilityIndex: 0.7 + (globalIdx % 3) * 0.1,
        },
      });
    }

    // ── Attendance (60 school days) ──────────────────────────────────────
    // Create a meeting per class per school day (reuse same meeting for all students in class)
    // We create meetings at school level for simplicity
    for (let di = 0; di < schoolDays60.length; di++) {
      const day = schoolDays60[di];
      const meetingId = `mtg-${code}-0-${di}`;
      // Upsert meeting once (will be same for all students in this class)
      if (si === 0) {
        await prisma.meeting.upsert({
          where: { id: meetingId },
          update: {},
          create: {
            id: meetingId,
            classId: primaryClassId,
            startsAt: schoolHourTs(day, 0),
            endsAt: schoolHourTs(day, 1),
          },
        });
      }

      const status = getAttendanceStatus(di, attendanceRate);
      await prisma.attendanceRecord.upsert({
        where: {
          meetingId_studentId: {
            meetingId,
            studentId: student.id,
          },
        },
        update: { status },
        create: {
          id: `att-${code}-${si}-${di}`,
          meetingId,
          studentId: student.id,
          status,
          markedAt: schoolHourTs(day, di % 8),
        },
      });
    }

    // ── AuditLog lesson views (10-15 per student over 90 days) ──────────
    const viewDays = schoolDaysBack(90);
    const viewCount = 10 + (si % 6);
    for (let vi = 0; vi < viewCount; vi++) {
      const day = viewDays[(vi * 6) % viewDays.length];
      await prisma.auditLog.create({
        data: {
          userId: studentUser.id,
          action: "lesson_view",
          resourceType: "scheduled_work",
          resourceId: primaryClassId,
          schoolId,
          createdAt: schoolHourTs(day, vi),
        },
      });
    }

    // ── Homework submission for most students ────────────────────────────
    if (si % 5 !== 4) { // skip ~20% of students
      const hwId = `hw-${code}-0-0`;
      const score = 50 + (globalIdx * 7 % 50);
      await prisma.homeworkSubmission.upsert({
        where: { homeworkId_studentId: { homeworkId: hwId, studentId: student.id } },
        update: {},
        create: {
          homeworkId: hwId,
          studentId: student.id,
          teacherScore: score,
          aiReviewed: si % 3 !== 0,
          aiScore: si % 3 !== 0 ? score - 5 + (si % 10) : null,
          answers: { q1: "Liberia", q2: "Monrovia" },
          submittedAt: schoolDays60[schoolDays60.length - 5],
        },
      });
    }

    // ── Guardian linkage (1-2 guardians per student) ─────────────────────
    const guardiansForStudent = 1 + (si % 3 === 0 ? 1 : 0);
    for (let gi = 0; gi < guardiansForStudent; gi++) {
      const gIdx = studentOffset * 3 + si * 2 + gi;
      const gName = generateGuardianName(gIdx);
      const gEmail = `guardian${gIdx + 1}@${code}.family.lr`;
      const relation = gi === 0 ? "Parent" : "Guardian";

      const guardianUser = await prisma.user.upsert({
        where: { email: gEmail },
        update: { hashedPwd: hashed, schoolId },
        create: { email: gEmail, name: gName, role: "GUARDIAN", hashedPwd: hashed, schoolId },
      });

      await prisma.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardianUser.id } },
        update: {},
        create: { studentId: student.id, guardianId: guardianUser.id, relation },
      });

      guardianCount++;
    }
  }

  return { studentCount: SC, guardianCount };
}

async function seedGuardianMessages(school: SchoolDef): Promise<void> {
  const { id: schoolId, code } = school;

  // Find a guardian and teacher pair for this school
  const [guardian, teacher, student] = await Promise.all([
    prisma.user.findFirst({ where: { schoolId, role: "GUARDIAN" }, select: { id: true } }),
    prisma.user.findFirst({ where: { schoolId, role: "TEACHER" }, select: { id: true } }),
    prisma.student.findFirst({
      where: { user: { schoolId } },
      select: { id: true },
    }),
  ]);

  if (!guardian || !teacher || !student) return;

  const threads = [
    {
      body: "Good morning! I wanted to check in about my child's progress in mathematics this term. Are there areas we should focus on at home?",
      fromRole: "guardian" as const,
      read: true,
    },
    {
      body: "Thank you for reaching out! Your child is doing well overall. I would encourage extra practice with fractions — we will cover more next week. Please ensure homework is submitted on time.",
      fromRole: "teacher" as const,
      read: true,
    },
    {
      body: "Thank you for the update, teacher. We will work on the fractions exercises at home. Is there a good time for a brief meeting this week?",
      fromRole: "guardian" as const,
      read: false,
    },
    {
      body: "I noticed my child missed two days last week due to illness. Can you please share what was covered so we can catch up?",
      fromRole: "guardian" as const,
      read: true,
    },
    {
      body: "No problem at all! I will send the lesson notes home with your child. The key topics were living organisms and their habitats. Please do not hesitate to reach out if you have more questions.",
      fromRole: "teacher" as const,
      read: false,
    },
  ];

  for (let i = 0; i < threads.length; i++) {
    const msgId = `gmsg-${code}-${i}`;
    await prisma.guardianMessage.upsert({
      where: { id: msgId },
      update: { read: threads[i].read },
      create: {
        id: msgId,
        guardianId: guardian.id,
        teacherId: teacher.id,
        studentId: student.id,
        schoolId,
        fromRole: threads[i].fromRole,
        body: threads[i].body,
        read: threads[i].read,
        sentAt: new Date(Date.now() - (threads.length - i) * 24 * 3_600_000),
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function getStudentOffsetForSchool(targetSchoolId: string): number {
  let offset = 0;
  for (const school of SCHOOL_DEFS) {
    if (school.id === targetSchoolId) return offset;
    offset += school.studentCount;
  }
  return 0;
}

export async function seedNationalDemo({
  prisma: providedPrisma,
  schoolIds,
  allowExisting = false,
  allowProduction = false,
  logger = console,
}: SeedNationalDemoOptions = {}): Promise<void> {
  const previousPrisma = prisma;
  if (providedPrisma) {
    prisma = providedPrisma;
  }

  try {
    if (isProduction() && !allowProduction) {
      logger.error("Refusing to run demo seed in production environment.");
      throw new Error("Demo seed is blocked in production");
    }

    const selectedSchools = schoolIds?.length
      ? SCHOOL_DEFS.filter((school) => schoolIds.includes(school.id))
      : [...SCHOOL_DEFS];

    if (selectedSchools.length === 0) {
      throw new Error("No valid demo schools selected for seeding");
    }

    if (!allowExisting) {
      const existing = await prisma.school.findFirst({
        where: { name: "Capitol Hill Academy" },
        select: { id: true },
      });
      if (existing) {
        logger.log("Demo seed already present, skipping.");
        return;
      }
    }

    logger.log("Starting LiberiaLearn national scale demo seed...");

    const [hashed, hashedMoe] = await Promise.all([
      bcrypt.hash("DemoSeed2026!", 10),
      bcrypt.hash("MOESeed2026!", 10),
    ]);

    await seedDistricts();
    await seedDemoStrands();
    await seedDemoCurriculumContent();
    await seedMoeOfficials(hashedMoe);

    for (const school of selectedSchools) {
      const studentOffset = getStudentOffsetForSchool(school.id);
      await seedSchool(school, hashed, hashedMoe, studentOffset);
      await seedGuardianMessages(school);
    }

    logger.log(`Demo seed complete for ${selectedSchools.length} school(s).`);
  } finally {
    prisma = previousPrisma;
  }
}

async function main() {
  // ── Safety check ──────────────────────────────────────────────────────────
  if (isProduction()) {
    console.error("❌  BLOCKED: Refusing to run demo seed in production environment.");
    console.error("   Set NODE_ENV to 'development' or 'staging' to use this script.");
    process.exit(1);
  }

  // ── Idempotency check ─────────────────────────────────────────────────────
  const existing = await prisma.school.findFirst({
    where: { name: "Capitol Hill Academy" },
    select: { id: true },
  });
  if (existing) {
    console.log("ℹ️  Demo seed already present — skipping.");
    console.log("   (Detected: Capitol Hill Academy school record exists)");
    await prisma.$disconnect();
    return;
  }

  console.log("\n🌱  Starting LiberiaLearn national scale demo seed…");
  console.log("   10 schools · 3 districts · ~300 students\n");

  // ── Password hashes ───────────────────────────────────────────────────────
  console.log("⏳  Hashing passwords…");
  const [hashed, hashedMoe] = await Promise.all([
    bcrypt.hash("DemoSeed2026!", 10),
    bcrypt.hash("MOESeed2026!", 10),
  ]);

  // ── Districts ─────────────────────────────────────────────────────────────
  console.log("🏛️   Seeding districts…");
  await seedDistricts();

  // ── Strand catalog subset ─────────────────────────────────────────────────
  console.log("📚  Ensuring demo strands…");
  await seedDemoStrands();

  // ── Curriculum content ────────────────────────────────────────────────────
  console.log("📖  Seeding curriculum content…");
  await seedDemoCurriculumContent();

  // ── MOE Officials ─────────────────────────────────────────────────────────
  console.log("🏛️   Seeding MOE official accounts…");
  await seedMoeOfficials(hashedMoe);

  // ── Schools (sequential to avoid ID collisions on meetings) ───────────────
  let totalStudents = 0;
  let totalGuardians = 0;
  let studentOffset = 0;

  for (const school of SCHOOL_DEFS) {
    console.log(`\n🏫  ${school.name} (${school.county})`);
    const counts = await seedSchool(school, hashed, hashedMoe, studentOffset);
    totalStudents += counts.studentCount;
    totalGuardians += counts.guardianCount;
    studentOffset += counts.studentCount;
    console.log(`    ✓ ${counts.studentCount} students, ${counts.guardianCount} guardians`);

    // Guardian message threads (after students + guardians exist)
    await seedGuardianMessages(school);
    console.log(`    ✓ Guardian messages seeded`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(58));
  console.log("✅  Demo seed complete!");
  console.log(`    Districts  : ${DISTRICT_DEFS.length}`);
  console.log(`    Schools    : ${SCHOOL_DEFS.length}`);
  console.log(`    Students   : ${totalStudents}`);
  console.log(`    Guardians  : ${totalGuardians}`);
  console.log(`    MOE accts  : 2 (official1@moe.gov.lr, official2@moe.gov.lr)`);
  console.log("");
  console.log("  Demo credentials:");
  console.log("    Students/Teachers/Admins: DemoSeed2026!");
  console.log("    MOE Officials           : MOESeed2026!");
  console.log("");
  console.log("  Enable these flags to see all demo data:");
  console.log("    ENABLE_GUARDIAN_DASHBOARD=true");
  console.log("    ENABLE_GUARDIAN_PORTAL=true");
  console.log("    ENABLE_MOE_LOGIN_PORTAL=true");
  console.log("    ENABLE_MOE_PORTAL=true");
  console.log("    NEXT_PUBLIC_ENABLE_AI_TUTOR=true");
  console.log("═".repeat(58));

  await prisma.$disconnect();
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  main().catch(async (e) => {
  console.error("❌  Seed failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
}
