// prisma/seed.ts — Idempotent MOE demo seed data
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASS = "Password123";

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

  const hashed = await bcrypt.hash(PASS, 10);

  // ========== SCHOOL 1: Monrovia Central Academy ==========
  const school1 = await prisma.school.upsert({
    where: { id: "school_mca" },
    update: {},
    create: {
      id: "school_mca",
      name: "Monrovia Central Academy",
      county: "Montserrado",
      district: "Greater Monrovia",
      contactName: "James Kollie",
      contactEmail: "jkollie@mca.edu.lr",
      contactPhone: "+231770100001",
      motto: "Excellence Through Knowledge",
      primaryHex: "#10b981",
      secondaryHex: "#8b5cf6",
      accentHex: "#10b981",
    },
  });

  // School 1 users
  const s1Admin = await prisma.user.upsert({
    where: { email: "jkollie@mca.edu.lr" },
    update: {},
    create: {
      email: "jkollie@mca.edu.lr", name: "James Kollie", role: "ADMIN",
      hashedPwd: hashed, schoolId: school1.id, isPlatformAdmin: true,
    },
  });

  const s1Teachers = [];
  for (const t of [
    { email: "mpewee@mca.edu.lr", name: "Mary Pewee" },
    { email: "dnimely@mca.edu.lr", name: "David Nimely" },
    { email: "sflomo@mca.edu.lr", name: "Sarah Flomo" },
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
    const email = studentEmail(name, "mca");
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
    const gEmail = `guardian${i + 1}@mca.edu.lr`;
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
  }

  // ========== SCHOOL 3: Kakata Rural School ==========
  const school3 = await prisma.school.upsert({
    where: { id: "school_krs" },
    update: {},
    create: {
      id: "school_krs",
      name: "Kakata Rural School",
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
  }

  // ========== CURRICULUM CONTENT + SCHEDULED WORK ==========
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const tomorrow = new Date(today.getTime() + 86400000);

  const lessons = [
    { id: "lesson_mca_1", grade: 7, subject: "MATH", title: "Introduction to Fractions", body: "In Liberia, when we share a cup of rice among family members, we are using fractions. A fraction represents a part of a whole. Today we will explore how fractions work in everyday life, from market trading to sharing resources in our communities." },
    { id: "lesson_mca_2", grade: 7, subject: "MATH", title: "Adding Fractions", body: "Building on our understanding of fractions, today we learn to add fractions with the same denominator and different denominators. Think about combining portions of cassava — if you have 1/4 of one batch and 1/2 of another, how much do you have in total?" },
    { id: "lesson_mca_3", grade: 8, subject: "LITERACY", title: "Reading Comprehension: Community Stories", body: "Read the passage about a day in the life of a farmer in Bong County. Identify the main idea, supporting details, and the author's purpose. Discuss how community stories preserve Liberian heritage." },
    { id: "lesson_pcs_1", grade: 6, subject: "SCIENCE", title: "Water and Living Things", body: "Water is essential for all living things. In Liberia, our rivers — the St. Paul, the St. John, the Cavalla — support entire communities. Today we study why water is vital for plant growth, animal survival, and human health." },
    { id: "lesson_pcs_2", grade: 9, subject: "LITERACY", title: "Essay Writing: My Community", body: "Write a five-paragraph essay about your community. Include an introduction, three body paragraphs about community strengths, challenges, and your vision for the future, and a conclusion." },
    { id: "lesson_krs_1", grade: 5, subject: "MATH", title: "Counting and Number Patterns", body: "We will explore number patterns found in nature and daily life. Count the seeds in a palm fruit, the legs on market tables, the steps from your house to school. Mathematics is all around us in Margibi County." },
  ];

  for (const l of lessons) {
    await prisma.curriculumContent.upsert({
      where: { contentId: l.id },
      update: {},
      create: {
        contentId: l.id,
        grade: l.grade,
        subject: l.subject,
        contentType: "lesson",
        status: "APPROVED",
        version: "1.0",
        payload: {
          title: l.title,
          body: l.body,
          objectives: [`Understand ${l.title.toLowerCase()}`, "Apply concepts to daily life in Liberia", "Demonstrate understanding through practice"],
          activities: ["Group discussion", "Practice worksheet", "Real-world application exercise"],
          labs: l.subject === "SCIENCE" ? [{ title: "Hands-on Observation", description: "Observe and record findings from the local environment" }] : [],
          durationMins: 45,
        } as any,
      },
    });
  }

  // Schedule work: yesterday/today/tomorrow for each school
  const scheduleEntries = [
    { id: "sw_mca_1", contentId: "lesson_mca_1", classId: s1c1.id, date: yesterday, createdById: s1Teachers[0].id },
    { id: "sw_mca_2", contentId: "lesson_mca_2", classId: s1c1.id, date: today, createdById: s1Teachers[0].id },
    { id: "sw_mca_3", contentId: "lesson_mca_3", classId: s1c2.id, date: tomorrow, createdById: s1Teachers[1].id },
    { id: "sw_pcs_1", contentId: "lesson_pcs_1", classId: s2c1.id, date: yesterday, createdById: s2Teachers[0].id },
    { id: "sw_pcs_2", contentId: "lesson_pcs_2", classId: s2c2.id, date: today, createdById: s2Teachers[1].id },
    { id: "sw_krs_1", contentId: "lesson_krs_1", classId: s3c1.id, date: yesterday, createdById: s3Teachers[0].id },
  ];

  for (const sw of scheduleEntries) {
    await prisma.scheduledWork.upsert({
      where: { id: sw.id },
      update: {},
      create: { id: sw.id, contentId: sw.contentId, classId: sw.classId, scheduledDate: sw.date, createdById: sw.createdById },
    });
  }

  // Student progress: some students completed yesterday's work
  for (let i = 0; i < 10; i++) {
    await prisma.studentProgress.upsert({
      where: { studentId_scheduledWorkId: { studentId: s1Students[i].user.id, scheduledWorkId: "sw_mca_1" } },
      update: {},
      create: {
        studentId: s1Students[i].user.id,
        scheduledWorkId: "sw_mca_1",
        startedAt: yesterday,
        completedAt: yesterday,
      },
    });
  }

  // Also keep old smoke-test compatible accounts
  await prisma.user.upsert({
    where: { email: "admin@mcs.edu.lr" },
    update: {},
    create: { email: "admin@mcs.edu.lr", name: "MCS Admin", role: "ADMIN", hashedPwd: hashed, schoolId: school1.id, isPlatformAdmin: true },
  });
  await prisma.user.upsert({
    where: { email: "teacher@mcs.edu.lr" },
    update: {},
    create: { email: "teacher@mcs.edu.lr", name: "MCS Teacher", role: "TEACHER", hashedPwd: hashed, schoolId: school1.id },
  });
  const smokeStudent = await prisma.user.upsert({
    where: { email: "student1@mcs.edu.lr" },
    update: {},
    create: { email: "student1@mcs.edu.lr", name: "MCS Student", role: "STUDENT", hashedPwd: hashed, schoolId: school1.id },
  });
  await prisma.student.upsert({
    where: { userId: smokeStudent.id },
    update: {},
    create: { userId: smokeStudent.id, county: "Montserrado" },
  });

  console.log("\n=== MOE Demo Credentials (Password: Password123) ===");
  console.log("Platform Admin: jkollie@mca.edu.lr");
  console.log("\nSchool 1 — Monrovia Central Academy:");
  console.log("  Admin:   jkollie@mca.edu.lr");
  console.log("  Teacher: mpewee@mca.edu.lr, dnimely@mca.edu.lr, sflomo@mca.edu.lr");
  console.log("  Student: fatu.flomo@mca.edu.lr");
  console.log("\nSchool 2 — Paynesville Community School:");
  console.log("  Admin:   gtokpah@pcs.edu.lr");
  console.log("  Teacher: esumo@pcs.edu.lr, pwreh@pcs.edu.lr");
  console.log("  Student: fatu.kpaan@pcs.edu.lr");
  console.log("\nSchool 3 — Kakata Rural School:");
  console.log("  Admin:   mkarnga@krs.edu.lr");
  console.log("  Teacher: fkollie@krs.edu.lr, abestman@krs.edu.lr");
  console.log("  Student: fatu.gbowee@krs.edu.lr");
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
