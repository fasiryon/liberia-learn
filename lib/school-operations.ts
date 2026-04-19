import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import {
  sendPlatformAdminSchoolPending,
  sendSchoolApprovalNotice,
  sendSchoolEnrollmentReceived,
  sendSchoolRejectionNotice,
  sendTeacherInvite,
} from "@/lib/email";
import { sendCredentialSms } from "@/lib/credentials";
import { normalizeCredentialPhone, normalizeLoginId, slugifyLoginSeed } from "@/lib/login-identifiers";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const LIBERIAN_COUNTIES = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe",
] as const;

type EnrollSchoolInput = {
  schoolName: string;
  county: string;
  district: string;
  schoolType: string;
  principalFullName: string;
  email: string;
  phone: string;
  estimatedStudentEnrollment: number;
};

type TeacherSettings = {
  active?: boolean;
  subjectSpecialty?: string | null;
};

type ImportRowInput = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  grade: number;
  dateOfBirth: string;
  guardianPhone?: string | null;
};

function pickRandomChars(length: number) {
  const bytes = randomBytes(length);
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += TEMP_PASSWORD_ALPHABET[bytes[index] % TEMP_PASSWORD_ALPHABET.length];
  }
  return value;
}

export function generateTemporaryPassword(length = 8) {
  return pickRandomChars(length);
}

function countyPrefix(county: string) {
  return county
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
}

async function buildUniqueSchoolCode(county: string) {
  const prefix = countyPrefix(county);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const candidate = `LIB-${prefix}-${suffix}`;
    const existing = await prisma.school.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `LIB-${prefix}-${Date.now().toString().slice(-4)}`;
}

async function buildUniqueLoginId(seed: string) {
  const base = normalizeLoginId(slugifyLoginSeed(seed) || "USER");
  let candidate = base;
  let attempt = 1;

  while (attempt <= 10) {
    const existing = await prisma.user.findFirst({
      where: { loginId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}

function readTeacherSettings(value: unknown): TeacherSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    active: typeof record.active === "boolean" ? record.active : undefined,
    subjectSpecialty: typeof record.subjectSpecialty === "string" ? record.subjectSpecialty : null,
  };
}

function mergeTeacherSettings(value: unknown, updates: TeacherSettings) {
  return {
    ...readTeacherSettings(value),
    ...updates,
  };
}

async function createPlatformAdminNotifications(
  schoolId: string,
  schoolName: string,
  county: string | null,
  principalName: string
) {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isPlatformAdmin: true,
      email: { not: null },
    },
    select: { id: true, email: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      await prisma.notificationLog.create({
        data: {
          userId: admin.id,
          channel: "in_app",
          recipient: admin.email ?? "platform-admin",
          subject: "Pending school enrollment",
          body: `${schoolName} is awaiting approval.`,
          status: "delivered",
        },
      });

      if (admin.email) {
        await sendPlatformAdminSchoolPending({
          to: admin.email,
          schoolName,
          county,
          principalName,
        }).catch(() => null);
      }
    })
  );

  await logLearningEvent({
    schoolId,
    eventType: "school.enrollment.pending",
    source: "school-operations",
    metadata: { schoolName, county },
  });
}

export async function createSchoolEnrollmentRequest(input: EnrollSchoolInput) {
  const loginId = await buildUniqueLoginId(input.principalFullName);
  const temporaryPassword = generateTemporaryPassword();
  const hashedPwd = await bcrypt.hash(temporaryPassword, 10);
  const phoneE164 = normalizeCredentialPhone(input.phone);

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.schoolName.trim(),
        county: input.county.trim(),
        district: input.district.trim(),
        schoolType: input.schoolType.trim(),
        contactName: input.principalFullName.trim(),
        contactEmail: input.email.trim().toLowerCase(),
        contactPhone: phoneE164,
        estimatedEnrollment: input.estimatedStudentEnrollment,
        status: "PENDING",
      },
      select: {
        id: true,
        name: true,
        county: true,
        contactEmail: true,
        contactName: true,
      },
    });

    const principal = await tx.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        loginId,
        name: input.principalFullName.trim(),
        role: "ADMIN",
        hashedPwd,
        mustChangePIN: true,
        schoolId: school.id,
        guardianPhone: input.phone.trim(),
        guardianPhoneE164: phoneE164,
        preferredChannel: phoneE164 ? "SMS" : "EMAIL",
      },
      select: {
        id: true,
        email: true,
      },
    });

    return { school, principal };
  });

  await logAudit({
    action: "school.enrollment.created",
    resourceType: "school",
    resourceId: result.school.id,
    schoolId: result.school.id,
    details: {
      schoolName: result.school.name,
      county: result.school.county,
      principalEmail: result.principal.email,
    },
  });

  await createPlatformAdminNotifications(
    result.school.id,
    result.school.name,
    result.school.county ?? null,
    result.school.contactName ?? input.principalFullName
  );

  if (result.school.contactEmail) {
    const statusUrl = `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/enroll/status?email=${encodeURIComponent(
      result.school.contactEmail
    )}`;
    await sendSchoolEnrollmentReceived({
      to: result.school.contactEmail,
      principalName: result.school.contactName ?? input.principalFullName,
      schoolName: result.school.name,
      loginId,
      temporaryPassword,
      statusUrl,
    }).catch(() => null);
  }

  return {
    schoolId: result.school.id,
    schoolName: result.school.name,
    principalEmail: result.school.contactEmail,
    loginId,
    temporaryPassword,
  };
}

export async function approveSchoolEnrollment(adminUserId: string, schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      county: true,
      contactEmail: true,
      contactName: true,
      code: true,
      users: {
        where: { role: "ADMIN", isPlatformAdmin: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!school) {
    throw Object.assign(new Error("School not found"), { status: 404 });
  }

  const schoolCode = school.code ?? (await buildUniqueSchoolCode(school.county ?? "LIB"));

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      status: "ACTIVE",
      code: schoolCode,
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  await logAudit({
    userId: adminUserId,
    action: "school.approved",
    resourceType: "school",
    resourceId: schoolId,
    schoolId,
    details: { schoolCode },
  });

  await logLearningEvent({
    schoolId,
    userId: adminUserId,
    actor: { type: "user", id: adminUserId, role: "ADMIN" },
    target: { type: "school", id: schoolId },
    eventType: "school.approved",
    source: "school-operations",
    metadata: { schoolCode },
  });

  const principalUserId = school.users[0]?.id ?? null;
  if (principalUserId && school.contactEmail) {
    await prisma.notificationLog.create({
      data: {
        userId: principalUserId,
        channel: "in_app",
        recipient: school.contactEmail,
        subject: "School approved",
        body: `${school.name} is active. School code: ${schoolCode}`,
        status: "delivered",
      },
    });

    await sendSchoolApprovalNotice({
      to: school.contactEmail,
      principalName: school.contactName ?? "Principal",
      schoolName: school.name,
      schoolCode,
      loginUrl: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`,
    }).catch(() => null);
  }

  return { schoolCode };
}

export async function rejectSchoolEnrollment(adminUserId: string, schoolId: string, reason?: string | null) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      contactName: true,
      users: {
        where: { role: "ADMIN", isPlatformAdmin: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!school) {
    throw Object.assign(new Error("School not found"), { status: 404 });
  }

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason?.trim() || null,
    },
  });

  await logAudit({
    userId: adminUserId,
    action: "school.rejected",
    resourceType: "school",
    resourceId: schoolId,
    schoolId,
    details: { reason: reason?.trim() || null },
  });

  await logLearningEvent({
    schoolId,
    userId: adminUserId,
    actor: { type: "user", id: adminUserId, role: "ADMIN" },
    target: { type: "school", id: schoolId },
    eventType: "school.rejected",
    source: "school-operations",
    metadata: { reason: reason?.trim() || null },
  });

  const principalUserId = school.users[0]?.id ?? null;
  if (principalUserId && school.contactEmail) {
    await prisma.notificationLog.create({
      data: {
        userId: principalUserId,
        channel: "in_app",
        recipient: school.contactEmail,
        subject: "School enrollment update",
        body: reason?.trim() || "Your enrollment request was not approved.",
        status: "delivered",
      },
    });

    await sendSchoolRejectionNotice({
      to: school.contactEmail,
      principalName: school.contactName ?? "Principal",
      schoolName: school.name,
      reason,
    }).catch(() => null);
  }
}

export async function inviteTeacherToSchool(input: {
  actorUserId: string;
  schoolId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  subjectSpecialty?: string | null;
}) {
  const school = await prisma.school.findUnique({
    where: { id: input.schoolId },
    select: { id: true, name: true },
  });
  if (!school) {
    throw Object.assign(new Error("School not found"), { status: 404 });
  }

  const loginId = await buildUniqueLoginId(input.email.split("@")[0] || input.fullName);
  const temporaryPassword = generateTemporaryPassword();
  const hashedPwd = await bcrypt.hash(temporaryPassword, 10);
  const phoneE164 = input.phone ? normalizeCredentialPhone(input.phone) : null;

  const teacher = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      loginId,
      name: input.fullName.trim(),
      role: "TEACHER",
      hashedPwd,
      mustChangePIN: true,
      schoolId: input.schoolId,
      guardianPhone: input.phone?.trim() || null,
      guardianPhoneE164: phoneE164,
      preferredChannel: phoneE164 ? "SMS" : "EMAIL",
      TeacherProfile: {
        create: {
          id: randomUUID(),
          schoolId: input.schoolId,
          fullName: input.fullName.trim(),
          phone: phoneE164,
          permissions: mergeTeacherSettings(null, {
            active: true,
            subjectSpecialty: input.subjectSpecialty?.trim() || null,
          }),
          gradesTaught: [],
          subjectsTaught: [],
          isOnboarded: false,
          updatedAt: new Date(),
        },
      },
    },
    select: { id: true, email: true },
  });

  await sendTeacherInvite({
    to: teacher.email,
    name: input.fullName.trim(),
    schoolName: school.name,
    inviteUrl: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login?role=teacher`,
  }).catch(() => null);

  await prisma.notificationLog.create({
    data: {
      userId: teacher.id,
      channel: "in_app",
      recipient: teacher.email,
      subject: "Teacher account created",
      body: `Login ID: ${loginId}. Temporary password: ${temporaryPassword}`,
      status: "delivered",
    },
  });

  if (phoneE164) {
    await sendCredentialSms({
      to: phoneE164,
      schoolName: school.name,
      name: input.fullName.trim(),
      loginId,
      pin: temporaryPassword,
      role: "Teacher",
    }).catch(() => null);
  }

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "school.teacher.invited",
    resourceType: "user",
    resourceId: teacher.id,
  });

  await logLearningEvent({
    schoolId: input.schoolId,
    userId: input.actorUserId,
    actor: { type: "user", id: input.actorUserId, role: "ADMIN" },
    target: { type: "user", id: teacher.id },
    eventType: "teacher.invited",
    source: "school-operations",
  });

  return { teacherId: teacher.id, loginId, temporaryPassword };
}

export async function deactivateTeacherForSchool(input: {
  actorUserId: string;
  schoolId: string;
  teacherId: string;
}) {
  const teacher = await prisma.user.findFirst({
    where: { id: input.teacherId, schoolId: input.schoolId, role: "TEACHER" },
    select: {
      id: true,
      TeacherProfile: { select: { permissions: true } },
    },
  });

  if (!teacher) {
    throw Object.assign(new Error("Teacher not found"), { status: 404 });
  }

  await prisma.teacherProfile.update({
    where: { userId: teacher.id },
    data: {
      permissions: mergeTeacherSettings(teacher.TeacherProfile?.permissions, { active: false }),
      updatedAt: new Date(),
    },
  });

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "school.teacher.deactivated",
    resourceType: "user",
    resourceId: teacher.id,
  });
}

export async function createClassForSchool(input: {
  actorUserId: string;
  schoolId: string;
  name: string;
  subject: "MATH" | "SCIENCE" | "COMPUTER_SCIENCE" | "ENGINEERING" | "LITERACY" | "CIVICS" | "ARTS" | "PE" | "CAREER";
  gradeLevel?: number | null;
  teacherId?: string | null;
}) {
  if (input.teacherId) {
    const teacher = await prisma.user.findFirst({
      where: { id: input.teacherId, schoolId: input.schoolId, role: "TEACHER" },
      select: { id: true },
    });
    if (!teacher) {
      throw Object.assign(new Error("Teacher not found"), { status: 404 });
    }
  }

  const created = await prisma.class.create({
    data: {
      schoolId: input.schoolId,
      name: input.name.trim(),
      subject: input.subject,
      gradeLevel: input.gradeLevel ?? null,
      teacherId: input.teacherId ?? null,
    },
    select: { id: true },
  });

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "school.class.created",
    resourceType: "class",
    resourceId: created.id,
  });

  return created;
}

export async function moveStudentBetweenClasses(input: {
  actorUserId: string;
  schoolId: string;
  studentId: string;
  targetClassId: string;
}) {
  const [student, targetClass] = await Promise.all([
    prisma.student.findFirst({
      where: { id: input.studentId, user: { schoolId: input.schoolId } },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { id: input.targetClassId, schoolId: input.schoolId },
      select: { id: true },
    }),
  ]);

  if (!student) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }
  if (!targetClass) {
    throw Object.assign(new Error("Target class not found"), { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.deleteMany({
      where: {
        studentId: input.studentId,
        Class: { schoolId: input.schoolId },
      },
    });
    await tx.enrollment.create({
      data: {
        studentId: input.studentId,
        classId: input.targetClassId,
      },
    });
  });

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "school.student.moved",
    resourceType: "student",
    resourceId: input.studentId,
    details: { targetClassId: input.targetClassId },
  });
}

function buildStudentUsername(firstName: string, lastName: string, schoolCode: string) {
  const first = slugifyLoginSeed(firstName) || "student";
  const last = slugifyLoginSeed(lastName) || "learner";
  return `${first}.${last}.${schoolCode.trim().toLowerCase()}`;
}

async function buildUniqueStudentUsername(firstName: string, lastName: string, schoolCode: string) {
  const base = buildStudentUsername(firstName, lastName, schoolCode);
  let candidate = base;
  let attempt = 1;

  while (attempt <= 10) {
    const existing = await prisma.user.findFirst({
      where: { loginId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}

function parseDateOfBirth(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date of birth");
  }
  return date;
}

async function findOrCreateGradeClass(schoolId: string, gradeLevel: number) {
  const existing = await prisma.class.findFirst({
    where: {
      schoolId,
      OR: [{ gradeLevel }, { name: { startsWith: `Grade ${gradeLevel}` } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.class.create({
    data: {
      schoolId,
      name: `Grade ${gradeLevel} - Imported`,
      subject: "LITERACY",
      gradeLevel,
    },
    select: { id: true },
  });

  return created.id;
}

async function findOrCreateGuardianForPhone(schoolId: string, phone: string, actorUserId: string) {
  const phoneE164 = normalizeCredentialPhone(phone);
  const existing = await prisma.user.findFirst({
    where: {
      role: "GUARDIAN",
      guardianPhoneE164: phoneE164,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const tempPassword = generateTemporaryPassword();
  const guardian = await prisma.user.create({
    data: {
      email: `${phoneE164.replace(/\D/g, "")}@guardian.local`,
      loginId: await buildUniqueLoginId(`guardian-${phoneE164}`),
      role: "GUARDIAN",
      hashedPwd: await bcrypt.hash(tempPassword, 10),
      mustChangePIN: true,
      guardianPhone: phone,
      guardianPhoneE164: phoneE164,
      preferredChannel: "SMS",
      schoolId,
    },
    select: { id: true },
  });

  await logAudit({
    userId: actorUserId,
    schoolId,
    action: "guardian.created_for_import",
    resourceType: "user",
    resourceId: guardian.id,
  });

  return guardian.id;
}

type ImportProcessSummary = {
  created: number;
  errors: Array<{ rowNumber: number; message: string }>;
  credentials: Array<{ name: string; username: string; temporaryPassword: string }>;
};

export async function processStudentImportBatch(batchId: string) {
  const batch = await prisma.studentImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      schoolId: true,
      createdById: true,
      resultSummary: true,
    },
  });

  if (!batch) {
    throw Object.assign(new Error("Import batch not found"), { status: 404 });
  }

  const payload = (batch.resultSummary ?? {}) as { rows?: ImportRowInput[] };
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  await prisma.studentImportBatch.update({
    where: { id: batchId },
    data: { status: "PROCESSING", processedRows: 0 },
  });

  const school = await prisma.school.findUnique({
    where: { id: batch.schoolId },
    select: { id: true, name: true, code: true },
  });

  if (!school?.code) {
    throw Object.assign(new Error("School code is required before importing students"), { status: 400 });
  }

  const summary: ImportProcessSummary = { created: 0, errors: [], credentials: [] };

  for (const row of rows) {
    try {
      const dateOfBirth = parseDateOfBirth(row.dateOfBirth);
      const targetName = `${row.firstName} ${row.lastName}`.trim();
      const duplicate = await prisma.student.findFirst({
        where: {
          dateOfBirth,
          user: {
            schoolId: batch.schoolId,
            name: { equals: targetName, mode: "insensitive" },
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: "Duplicate student with same name and date of birth already exists in this school.",
        });
        continue;
      }

      const classId = await findOrCreateGradeClass(batch.schoolId, row.grade);
      const username = await buildUniqueStudentUsername(row.firstName, row.lastName, school.code);
      const temporaryPassword = generateTemporaryPassword();
      const hashedPwd = await bcrypt.hash(temporaryPassword, 10);
      const guardianPhone = row.guardianPhone?.trim() || null;
      const guardianPhoneE164 = guardianPhone ? normalizeCredentialPhone(guardianPhone) : null;
      const guardianId = guardianPhone
        ? await findOrCreateGuardianForPhone(batch.schoolId, guardianPhone, batch.createdById)
        : null;

      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${username}@student.local`,
            loginId: username,
            name: targetName,
            role: "STUDENT",
            hashedPwd,
            mustChangePIN: true,
            schoolId: batch.schoolId,
            guardianPhone,
            guardianPhoneE164,
            preferredChannel: guardianPhoneE164 ? "SMS" : "EMAIL",
          },
          select: { id: true, name: true },
        });

        const student = await tx.student.create({
          data: {
            userId: user.id,
            currentGrade: row.grade,
            dateOfBirth,
          },
          select: { id: true },
        });

        await tx.enrollment.create({ data: { studentId: student.id, classId } });

        if (guardianId) {
          await tx.studentGuardian.upsert({
            where: { studentId_guardianId: { studentId: student.id, guardianId } },
            update: {},
            create: { studentId: student.id, guardianId, relation: "GUARDIAN" },
          });
        }

        return { studentId: student.id, studentName: user.name ?? "Student" };
      });

      summary.created += 1;
      summary.credentials.push({ name: created.studentName, username, temporaryPassword });

      await logAudit({
        userId: batch.createdById,
        schoolId: batch.schoolId,
        action: "student.imported",
        resourceType: "student",
        resourceId: created.studentId,
        details: { rowNumber: row.rowNumber, grade: row.grade },
      });
    } catch (error: any) {
      summary.errors.push({
        rowNumber: row.rowNumber,
        message: error?.message ?? "Unable to import row.",
      });
    }
  }

  const credentialCsv = [
    "name,username,temporaryPassword",
    ...summary.credentials.map((entry) =>
      [entry.name, entry.username, entry.temporaryPassword]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  await prisma.studentImportBatch.update({
    where: { id: batchId },
    data: {
      status: summary.errors.length > 0 && summary.created === 0 ? "FAILED" : "COMPLETED",
      processedRows: rows.length,
      successCount: summary.created,
      errorCount: summary.errors.length,
      completedAt: new Date(),
      resultSummary: { rows, created: summary.created, errors: summary.errors },
      credentialCsv,
    },
  });

  await logLearningEvent({
    schoolId: batch.schoolId,
    userId: batch.createdById,
    actor: { type: "user", id: batch.createdById, role: "ADMIN" },
    target: { type: "student_import_batch", id: batchId },
    eventType: "student.import.completed",
    source: "school-operations",
    metadata: { created: summary.created, errors: summary.errors.length },
  });

  return summary;
}

export async function createStudentImportBatch(input: {
  actorUserId: string;
  schoolId: string;
  fileName?: string | null;
  rows: ImportRowInput[];
}) {
  const shouldQueue = input.rows.length > 50 && isQueueConfigured();
  const batch = await prisma.studentImportBatch.create({
    data: {
      schoolId: input.schoolId,
      createdById: input.actorUserId,
      status: shouldQueue ? "QUEUED" : "PENDING",
      sourceFileName: input.fileName ?? null,
      totalRows: input.rows.length,
      queuedAt: shouldQueue ? new Date() : null,
      resultSummary: { rows: input.rows },
    },
    select: { id: true, status: true },
  });

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "student.import.created",
    resourceType: "student_import_batch",
    resourceId: batch.id,
    details: { rowCount: input.rows.length },
  });

  if (shouldQueue) {
    await enqueueJob(JobType.STUDENT_IMPORT, { batchId: batch.id, schoolId: input.schoolId });
    return { batchId: batch.id, status: batch.status };
  }

  await processStudentImportBatch(batch.id);
  return { batchId: batch.id, status: "COMPLETED" };
}

export async function getImportBatchForSchool(schoolId: string, batchId: string) {
  const batch = await prisma.studentImportBatch.findFirst({
    where: { id: batchId, schoolId },
    select: {
      id: true,
      status: true,
      totalRows: true,
      processedRows: true,
      successCount: true,
      errorCount: true,
      resultSummary: true,
      credentialCsv: true,
      downloadedAt: true,
      createdAt: true,
      completedAt: true,
    },
  });

  if (!batch) {
    throw Object.assign(new Error("Import batch not found"), { status: 404 });
  }

  return batch;
}

export async function consumeImportBatchCredentialCsv(schoolId: string, batchId: string) {
  const batch = await prisma.studentImportBatch.findFirst({
    where: { id: batchId, schoolId },
    select: { id: true, credentialCsv: true },
  });

  if (!batch) {
    throw Object.assign(new Error("Import batch not found"), { status: 404 });
  }
  if (!batch.credentialCsv) {
    throw Object.assign(new Error("Credential CSV is no longer available"), { status: 410 });
  }

  await prisma.studentImportBatch.update({
    where: { id: batch.id },
    data: { downloadedAt: new Date(), credentialCsv: null },
  });

  return batch.credentialCsv;
}

export async function getPrincipalSchoolDashboard(schoolId: string) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [
    school,
    studentCount,
    teacherRows,
    attempts,
    completedLessons,
    totalLessons,
    classes,
    sessions,
  ] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        county: true,
        district: true,
        schoolType: true,
        logoUrl: true,
        contactEmail: true,
        contactName: true,
        contactPhone: true,
      },
    }),
    prisma.user.count({ where: { schoolId, role: "STUDENT" } }),
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      select: {
        id: true,
        name: true,
        email: true,
        TeacherProfile: { select: { fullName: true, permissions: true } },
        teacherOf: { select: { id: true, name: true, gradeLevel: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assessmentAttempt.findMany({
      where: { schoolId, attemptedAt: { gte: since } },
      select: { score: true, userId: true },
    }),
    prisma.studentProgress.count({
      where: { student: { schoolId }, completedAt: { not: null } },
    }),
    prisma.studentProgress.count({ where: { student: { schoolId } } }),
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        subject: true,
        gradeLevel: true,
        enrollments: { select: { studentId: true } },
      },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    }),
    prisma.session.findMany({
      where: { user: { schoolId, role: "TEACHER" } },
      select: { userId: true, expires: true },
      orderBy: { expires: "desc" },
    }),
  ]);

  if (!school) {
    throw Object.assign(new Error("School not found"), { status: 404 });
  }

  const activeIds = new Set(
    attempts
      .map((attempt) => attempt.userId)
      .filter((value): value is string => Boolean(value))
  );
  const avgQuizScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / attempts.length)
      : 0;
  const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const lastLoginByTeacher = new Map<string, Date>();
  for (const session of sessions) {
    if (!lastLoginByTeacher.has(session.userId)) {
      lastLoginByTeacher.set(session.userId, session.expires);
    }
  }

  return {
    school,
    metrics: {
      totalStudents: studentCount,
      totalTeachers: teacherRows.length,
      activeThisWeek: activeIds.size,
      avgQuizScore,
      completionRate,
    },
    gradeBreakdown: classes.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      subject: String(classroom.subject),
      gradeLevel: classroom.gradeLevel ?? null,
      studentCount: classroom.enrollments.length,
    })),
    teachers: teacherRows.map((teacher) => {
      const settings = readTeacherSettings(teacher.TeacherProfile?.permissions);
      return {
        id: teacher.id,
        name: teacher.TeacherProfile?.fullName ?? teacher.name ?? teacher.email ?? "Teacher",
        email: teacher.email,
        active: settings.active !== false,
        classesAssigned: teacher.teacherOf.map((item) => ({
          id: item.id,
          name: item.name,
          gradeLevel: item.gradeLevel ?? null,
        })),
        lastLoginAt: lastLoginByTeacher.get(teacher.id)?.toISOString() ?? null,
      };
    }),
    registrationLink: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/register/student?code=${encodeURIComponent(
      school.code ?? ""
    )}`,
  };
}
