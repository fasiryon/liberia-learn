import { createHash, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { GradeBand, PrismaClient, Subject, type Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { generatePin } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import {
  deterministicOneRosterSourcedId,
  type OneRosterExportData,
  type OneRosterParseResult,
} from "@/lib/interoperability/oneroster";
import { normalizeLoginId } from "@/lib/login-identifiers";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";

type StoredOneRosterPayload = {
  kind: "ONEROSTER_1_2_BULK";
  packageSchoolSourcedId: string;
  rows: OneRosterParseResult["rows"];
};

type ImportIssue = {
  entity: "user" | "class" | "enrollment" | "batch";
  sourcedId: string;
  message: string;
};

type ImportCredential = {
  name: string;
  username: string;
  temporaryPassword: string;
  role: "STUDENT" | "TEACHER";
};

const SUBJECT_LABELS: Record<Subject, string> = {
  MATH: "Mathematics",
  SCIENCE: "Science",
  COMPUTER_SCIENCE: "Computer Science",
  ENGINEERING: "Engineering",
  LITERACY: "Literacy",
  ENGLISH: "English",
  CIVICS: "Civics",
  ARTS: "Arts",
  PE: "Physical Education",
  CAREER: "Career Education",
};

const SUBJECT_ALIASES: Record<string, Subject> = {
  MATHEMATICS: "MATH",
  MATH: "MATH",
  SCIENCE: "SCIENCE",
  COMPUTER_SCIENCE: "COMPUTER_SCIENCE",
  "COMPUTER SCIENCE": "COMPUTER_SCIENCE",
  ENGINEERING: "ENGINEERING",
  LITERACY: "LITERACY",
  ENGLISH: "ENGLISH",
  CIVICS: "CIVICS",
  ARTS: "ARTS",
  ART: "ARTS",
  PE: "PE",
  "PHYSICAL EDUCATION": "PE",
  CAREER: "CAREER",
  "CAREER EDUCATION": "CAREER",
};

function splitName(name: string | null, fallback: string) {
  const parts = (name?.trim() || fallback).split(/\s+/).filter(Boolean);
  return {
    givenName: parts[0] || "User",
    familyName: parts.slice(1).join(" ") || "User",
  };
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function schoolYearEnd(date: Date) {
  return String(date.getUTCFullYear());
}

function gradeBand(grade: number | null): GradeBand[] {
  if (!grade) return [];
  if (grade <= 3) return ["G1_3"];
  if (grade <= 6) return ["G4_6"];
  if (grade <= 9) return ["G7_9"];
  return ["G10_12"];
}

function parseGrade(values?: string[]) {
  const value = Number(values?.[0]);
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

function resolveSubject(subjectCodes?: string[], subjects?: string[]) {
  const candidates = [...(subjectCodes ?? []), ...(subjects ?? [])];
  for (const candidate of candidates) {
    const normalized = candidate.trim().toUpperCase().replace(/-/g, "_");
    if (SUBJECT_ALIASES[normalized]) return SUBJECT_ALIASES[normalized];
    if ((Object.values(Subject) as string[]).includes(normalized)) return normalized as Subject;
  }
  return null;
}

function localUserId(userIds?: string[]) {
  for (const value of userIds ?? []) {
    const match = value.match(/^\{liberialearn:([^}]+)\}$/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function generatedIdentifier(prefix: string, schoolId: string, sourcedId: string) {
  return `${prefix}-${createHash("sha256").update(`${schoolId}:${sourcedId}`).digest("hex").slice(0, 20)}`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function credentialCsv(credentials: ImportCredential[]) {
  return [
    "name,username,temporaryPassword,role",
    ...credentials.map((entry) =>
      [entry.name, entry.username, entry.temporaryPassword, entry.role].map(csvCell).join(",")
    ),
  ].join("\n");
}

function writeClient() {
  const directUrl = process.env.DIRECT_URL?.trim() ?? "";
  if (!directUrl) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(new Error("DIRECT_URL is required for OneRoster imports"), { status: 503 });
    }
    return { client: prisma, disconnect: async () => undefined };
  }

  const parsed = new URL(directUrl);
  if (process.env.NODE_ENV === "production" && parsed.port && parsed.port !== "5432") {
    throw Object.assign(new Error("DIRECT_URL must use the direct database port 5432"), { status: 503 });
  }
  const client = new PrismaClient({ datasources: { db: { url: directUrl } } });
  return { client, disconnect: () => client.$disconnect() };
}

export async function buildSchoolOneRosterData(schoolId: string): Promise<OneRosterExportData> {
  const [school, academicYear, users, classes] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, code: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId },
      include: { terms: { orderBy: { startDate: "asc" } } },
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    }),
    prisma.user.findMany({
      where: { schoolId, role: { in: ["STUDENT", "TEACHER"] } },
      select: {
        id: true,
        email: true,
        loginId: true,
        name: true,
        role: true,
        phone: true,
        updatedAt: true,
        student: { select: { id: true, currentGrade: true, dateOfBirth: true, deletedAt: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        subject: true,
        gradeLevel: true,
        teacherId: true,
        enrollments: { select: { id: true, Student: { select: { userId: true } } } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!school) throw Object.assign(new Error("School not found"), { status: 404 });
  if (!academicYear) {
    throw Object.assign(new Error("An academic year is required before exporting OneRoster"), { status: 409 });
  }
  if (classes.length === 0) {
    throw Object.assign(new Error("At least one class is required before exporting OneRoster"), { status: 409 });
  }

  const activeUsers = users.filter((user) => !user.student?.deletedAt);
  const exportedUserIds = new Set(activeUsers.map((user) => user.id));
  const schoolSourcedId = deterministicOneRosterSourcedId("school", school.id);
  const schoolYearSourcedId = deterministicOneRosterSourcedId("academic-session", academicYear.id);
  const termRows = academicYear.terms.map((term) => ({
    sourcedId: deterministicOneRosterSourcedId("term", term.id),
    title: term.name,
    type: "term" as const,
    startDate: dateOnly(term.startDate),
    endDate: dateOnly(term.endDate),
    parentSourcedId: schoolYearSourcedId,
    schoolYear: schoolYearEnd(academicYear.endDate),
  }));
  const classTermIds = termRows.length > 0 ? termRows.map((term) => term.sourcedId) : [schoolYearSourcedId];

  const oneRosterUsers = activeUsers.map((user) => {
    const username = user.loginId?.trim() || user.email;
    const name = splitName(user.name, username);
    return {
      sourcedId: deterministicOneRosterSourcedId("user", user.id),
      enabledUser: true,
      username,
      userIds: [`{liberialearn:${user.id}}`],
      givenName: name.givenName,
      familyName: name.familyName,
      email: user.email,
      phone: user.phone ?? undefined,
      grades: user.student?.currentGrade ? [String(user.student.currentGrade)] : undefined,
      primaryOrgSourcedId: schoolSourcedId,
    };
  });
  const userSourcedId = new Map(activeUsers.map((user, index) => [user.id, oneRosterUsers[index].sourcedId]));

  const roles = activeUsers.map((user) => ({
    sourcedId: deterministicOneRosterSourcedId("role", `${school.id}:${user.id}:${user.role}`),
    userSourcedId: userSourcedId.get(user.id)!,
    roleType: "primary" as const,
    role: user.role === "TEACHER" ? ("teacher" as const) : ("student" as const),
    orgSourcedId: schoolSourcedId,
  }));

  const courses = classes.map((record) => ({
    sourcedId: deterministicOneRosterSourcedId("course", record.id),
    schoolYearSourcedId,
    title: record.name,
    courseCode: record.id,
    grades: record.gradeLevel ? [String(record.gradeLevel)] : undefined,
    orgSourcedId: schoolSourcedId,
    subjects: [SUBJECT_LABELS[record.subject]],
    subjectCodes: [record.subject],
  }));
  const courseIds = new Map(classes.map((record, index) => [record.id, courses[index].sourcedId]));
  const oneRosterClasses = classes.map((record) => ({
    sourcedId: deterministicOneRosterSourcedId("class", record.id),
    title: record.name,
    grades: record.gradeLevel ? [String(record.gradeLevel)] : undefined,
    courseSourcedId: courseIds.get(record.id)!,
    classCode: record.id,
    classType: "scheduled" as const,
    schoolSourcedId,
    termSourcedIds: classTermIds,
    subjects: [SUBJECT_LABELS[record.subject]],
    subjectCodes: [record.subject],
  }));
  const classIds = new Map(classes.map((record, index) => [record.id, oneRosterClasses[index].sourcedId]));

  const enrollments = classes.flatMap((record) => {
    const rows: OneRosterExportData["enrollments"] = record.enrollments
      .filter((enrollment) => exportedUserIds.has(enrollment.Student.userId))
      .map((enrollment) => ({
        sourcedId: deterministicOneRosterSourcedId("enrollment", enrollment.id),
        classSourcedId: classIds.get(record.id)!,
        schoolSourcedId,
        userSourcedId: userSourcedId.get(enrollment.Student.userId)!,
        role: "student" as const,
      }));
    if (record.teacherId && exportedUserIds.has(record.teacherId)) {
      rows.push({
        sourcedId: deterministicOneRosterSourcedId("enrollment", `${record.id}:${record.teacherId}:teacher`),
        classSourcedId: classIds.get(record.id)!,
        schoolSourcedId,
        userSourcedId: userSourcedId.get(record.teacherId)!,
        role: "teacher" as const,
        primary: true,
      });
    }
    return rows;
  });
  if (enrollments.length === 0) {
    throw Object.assign(new Error("At least one class enrollment is required before exporting OneRoster"), { status: 409 });
  }

  return {
    sourceSystemName: "LiberiaLearn",
    sourceSystemCode: "liberialearn",
    orgs: [{ sourcedId: schoolSourcedId, name: school.name, type: "school", identifier: school.code ?? undefined }],
    academicSessions: [
      {
        sourcedId: schoolYearSourcedId,
        title: academicYear.yearLabel,
        type: "schoolYear",
        startDate: dateOnly(academicYear.startDate),
        endDate: dateOnly(academicYear.endDate),
        schoolYear: schoolYearEnd(academicYear.endDate),
      },
      ...termRows,
    ],
    courses,
    classes: oneRosterClasses,
    users: oneRosterUsers,
    roles,
    enrollments,
    demographics: activeUsers
      .filter((user) => user.student?.dateOfBirth)
      .map((user) => ({
        sourcedId: userSourcedId.get(user.id)!,
        birthDate: dateOnly(user.student!.dateOfBirth!),
      })),
  };
}

function assertStoredPayload(value: unknown): StoredOneRosterPayload {
  const payload = value as StoredOneRosterPayload;
  if (payload?.kind !== "ONEROSTER_1_2_BULK" || !payload.rows || !payload.packageSchoolSourcedId) {
    throw Object.assign(new Error("Import batch does not contain a OneRoster package"), { status: 400 });
  }
  return payload;
}

export async function createOneRosterImportBatch(input: {
  actorUserId: string;
  schoolId: string;
  fileName: string;
  parsed: OneRosterParseResult;
}) {
  if (!input.parsed.valid) {
    throw Object.assign(new Error("OneRoster package validation failed"), { status: 422 });
  }
  const school = await prisma.school.findUnique({
    where: { id: input.schoolId },
    select: { code: true },
  });
  if (!school) throw Object.assign(new Error("School not found"), { status: 404 });
  const packageSchool = input.parsed.rows.orgs[0];
  if (school.code && packageSchool.identifier && school.code !== packageSchool.identifier) {
    throw Object.assign(new Error("OneRoster package school identifier does not match this school"), { status: 409 });
  }

  const totalRows =
    input.parsed.rows.users.length +
    input.parsed.rows.classes.length +
    input.parsed.rows.enrollments.length;
  if (totalRows < 1 || totalRows > 1500) {
    throw Object.assign(new Error("OneRoster imports must contain between 1 and 1500 operational rows"), { status: 400 });
  }
  const queued = totalRows > 50 && isQueueConfigured();
  const payload: StoredOneRosterPayload = {
    kind: "ONEROSTER_1_2_BULK",
    packageSchoolSourcedId: packageSchool.sourcedId,
    rows: input.parsed.rows,
  };
  const batch = await prisma.studentImportBatch.create({
    data: {
      schoolId: input.schoolId,
      createdById: input.actorUserId,
      status: queued ? "QUEUED" : "PENDING",
      sourceFileName: input.fileName,
      totalRows,
      queuedAt: queued ? new Date() : null,
      resultSummary: payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true },
  });

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId,
    action: "admin.interoperability.oneroster.import.created",
    resourceType: "student_import_batch",
    resourceId: batch.id,
    details: { totalRows, fileName: input.fileName, queued },
  });

  if (queued) {
    const enqueued = await enqueueJob(
      JobType.ONEROSTER_IMPORT,
      { batchId: batch.id, schoolId: input.schoolId },
      { messageGroupId: input.schoolId, messageDeduplicationId: batch.id }
    );
    if (!enqueued) {
      await prisma.studentImportBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", completedAt: new Date(), errorCount: totalRows },
      });
      throw Object.assign(new Error("Import queue is unavailable"), { status: 503 });
    }
    return { batchId: batch.id, status: "QUEUED", accepted: totalRows };
  }

  const result = await processOneRosterImportBatch(batch.id, input.schoolId);
  return { batchId: batch.id, status: result.status, accepted: totalRows, ...result };
}

export async function processOneRosterImportBatch(batchId: string, expectedSchoolId?: string) {
  const batch = await prisma.studentImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true, schoolId: true, createdById: true, status: true, resultSummary: true, totalRows: true },
  });
  if (!batch) throw Object.assign(new Error("Import batch not found"), { status: 404 });
  if (expectedSchoolId && batch.schoolId !== expectedSchoolId) {
    throw Object.assign(new Error("Import batch school mismatch"), { status: 403 });
  }
  if (batch.status === "COMPLETED") {
    const summary = batch.resultSummary as Record<string, unknown> | null;
    return {
      status: "COMPLETED",
      successCount: Number(summary?.successCount ?? 0),
      errorCount: Number(summary?.errorCount ?? 0),
      hasCredentials: Number(summary?.credentialCount ?? 0) > 0,
    };
  }
  const payload = assertStoredPayload(batch.resultSummary);
  const claim = await prisma.studentImportBatch.updateMany({
    where: { id: batch.id, schoolId: batch.schoolId, status: { in: ["PENDING", "QUEUED", "FAILED"] } },
    data: { status: "PROCESSING", processedRows: 0 },
  });
  if (claim.count !== 1) {
    throw Object.assign(new Error("Import batch is already processing"), { status: 409 });
  }

  const issues: ImportIssue[] = [];
  const warnings: string[] = [];
  const credentials: ImportCredential[] = [];
  let successCount = 0;
  const { client: writes, disconnect } = writeClient();

  try {
    const roleByUser = new Map(payload.rows.roles.map((role) => [role.userSourcedId, role.role]));
    const classBySourcedId = new Map(payload.rows.classes.map((record) => [record.sourcedId, record]));
    const teacherClasses = new Map<string, typeof payload.rows.classes>();
    for (const enrollment of payload.rows.enrollments.filter((row) => row.role === "teacher")) {
      const list = teacherClasses.get(enrollment.userSourcedId) ?? [];
      const record = classBySourcedId.get(enrollment.classSourcedId);
      if (record) list.push(record);
      teacherClasses.set(enrollment.userSourcedId, list);
    }

    const localIds = payload.rows.users.map((user) => localUserId(user.userIds)).filter((id): id is string => Boolean(id));
    const emails = payload.rows.users.map((user) => user.email?.toLowerCase()).filter((email): email is string => Boolean(email));
    const loginIds = payload.rows.users.map((user) => normalizeLoginId(user.username)).filter(Boolean);
    const existingUsers = await prisma.user.findMany({
      where: { OR: [{ id: { in: localIds } }, { email: { in: emails } }, { loginId: { in: loginIds } }] },
      select: { id: true, email: true, loginId: true, role: true, schoolId: true, student: { select: { id: true } } },
    });
    const existingById = new Map(existingUsers.map((user) => [user.id, user]));
    const existingByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
    const existingByLogin = new Map(existingUsers.filter((user) => user.loginId).map((user) => [user.loginId!, user]));
    const importedUsers = new Map<string, { userId: string; studentId: string | null; role: "STUDENT" | "TEACHER" }>();
    const demographics = new Map(payload.rows.demographics.map((row) => [row.sourcedId, row]));

    for (const user of payload.rows.users) {
      try {
        const oneRosterRole = roleByUser.get(user.sourcedId);
        const role = oneRosterRole === "student" ? "STUDENT" : oneRosterRole === "teacher" ? "TEACHER" : null;
        if (!role) throw new Error("Only student and teacher user roles are supported");
        const loginId = normalizeLoginId(user.username) || generatedIdentifier("or", batch.schoolId, user.sourcedId);
        const email = user.email?.trim().toLowerCase() || `${generatedIdentifier("or", batch.schoolId, user.sourcedId)}@oneroster.local`;
        const localId = localUserId(user.userIds);
        const existing =
          (localId ? existingById.get(localId) : undefined) ??
          existingByEmail.get(email) ??
          existingByLogin.get(loginId);
        if (existing && existing.schoolId !== batch.schoolId) {
          throw new Error("Matched account belongs to another school");
        }
        if (existing && existing.role !== role) {
          throw new Error(`Matched account has role ${existing.role}, not ${role}`);
        }
        const fullName = `${user.givenName} ${user.familyName}`.trim();
        const grade = parseGrade(user.grades);
        const demographic = demographics.get(user.sourcedId);
        const subjects = Array.from(
          new Set((teacherClasses.get(user.sourcedId) ?? []).map((record) => resolveSubject(record.subjectCodes, record.subjects)).filter((value): value is Subject => Boolean(value)))
        );
        const grades = Array.from(new Set((teacherClasses.get(user.sourcedId) ?? []).map((record) => parseGrade(record.grades)).filter((value): value is number => Boolean(value))));

        if (existing) {
          await writes.user.update({
            where: { id: existing.id },
            data: { name: fullName },
          });
          if (role === "STUDENT") {
            const student = await writes.student.upsert({
              where: { userId: existing.id },
              update: { currentGrade: grade, dateOfBirth: demographic?.birthDate ? new Date(`${demographic.birthDate}T00:00:00.000Z`) : undefined },
              create: { userId: existing.id, currentGrade: grade, dateOfBirth: demographic?.birthDate ? new Date(`${demographic.birthDate}T00:00:00.000Z`) : null },
              select: { id: true },
            });
            importedUsers.set(user.sourcedId, { userId: existing.id, studentId: student.id, role });
          } else {
            await writes.teacherProfile.upsert({
              where: { userId: existing.id },
              update: { schoolId: batch.schoolId, fullName, subjectsTaught: subjects, gradesTaught: grades.flatMap(gradeBand), updatedAt: new Date() },
              create: { id: randomUUID(), userId: existing.id, schoolId: batch.schoolId, fullName, subjectsTaught: subjects, gradesTaught: grades.flatMap(gradeBand), updatedAt: new Date() },
            });
            importedUsers.set(user.sourcedId, { userId: existing.id, studentId: null, role });
          }
        } else {
          const temporaryPassword = generatePin();
          const created = await writes.user.create({
            data: {
              email,
              loginId,
              name: fullName,
              role,
              hashedPwd: await bcrypt.hash(temporaryPassword, 10),
              mustChangePIN: true,
              schoolId: batch.schoolId,
            },
            select: { id: true },
          });
          if (role === "STUDENT") {
            const student = await writes.student.create({
              data: {
                userId: created.id,
                currentGrade: grade,
                dateOfBirth: demographic?.birthDate ? new Date(`${demographic.birthDate}T00:00:00.000Z`) : null,
              },
              select: { id: true },
            });
            importedUsers.set(user.sourcedId, { userId: created.id, studentId: student.id, role });
          } else {
            await writes.teacherProfile.create({
              data: { id: randomUUID(), userId: created.id, schoolId: batch.schoolId, fullName, subjectsTaught: subjects, gradesTaught: grades.flatMap(gradeBand), updatedAt: new Date() },
            });
            importedUsers.set(user.sourcedId, { userId: created.id, studentId: null, role });
          }
          credentials.push({ name: fullName, username: loginId, temporaryPassword, role });
        }
        successCount += 1;
      } catch (error) {
        issues.push({ entity: "user", sourcedId: user.sourcedId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const importedClasses = new Map<string, string>();
    for (const record of payload.rows.classes) {
      try {
        const subject = resolveSubject(record.subjectCodes, record.subjects);
        if (!subject) throw new Error("Class subject is not supported by LiberiaLearn");
        const gradeLevel = parseGrade(record.grades);
        const byId = record.classCode
          ? await prisma.class.findFirst({ where: { id: record.classCode, schoolId: batch.schoolId }, select: { id: true } })
          : null;
        const existing = byId ?? await prisma.class.findFirst({
          where: { schoolId: batch.schoolId, name: { equals: record.title, mode: "insensitive" }, gradeLevel, subject },
          select: { id: true },
        });
        const saved = existing
          ? await writes.class.update({ where: { id: existing.id }, data: { name: record.title, subject, gradeLevel }, select: { id: true } })
          : await writes.class.create({ data: { schoolId: batch.schoolId, name: record.title, subject, gradeLevel }, select: { id: true } });
        importedClasses.set(record.sourcedId, saved.id);
        successCount += 1;
      } catch (error) {
        issues.push({ entity: "class", sourcedId: record.sourcedId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const teacherEnrollments = new Map<string, typeof payload.rows.enrollments>();
    for (const enrollment of payload.rows.enrollments.filter((row) => row.role === "teacher")) {
      const list = teacherEnrollments.get(enrollment.classSourcedId) ?? [];
      list.push(enrollment);
      teacherEnrollments.set(enrollment.classSourcedId, list);
    }
    for (const [classSourcedId, rows] of teacherEnrollments) {
      if (rows.length > 1) {
        warnings.push(`Class ${classSourcedId} has multiple teachers; LiberiaLearn stored the primary teacher only.`);
      }
    }

    for (const enrollment of payload.rows.enrollments) {
      try {
        const user = importedUsers.get(enrollment.userSourcedId);
        const classId = importedClasses.get(enrollment.classSourcedId);
        if (!user) throw new Error("Enrollment user was not imported");
        if (!classId) throw new Error("Enrollment class was not imported");
        if (enrollment.role === "student") {
          if (!user.studentId || user.role !== "STUDENT") throw new Error("Student enrollment references a non-student user");
          await writes.enrollment.upsert({
            where: { studentId_classId: { studentId: user.studentId, classId } },
            update: {},
            create: { studentId: user.studentId, classId },
          });
        } else {
          const classTeachers = teacherEnrollments.get(enrollment.classSourcedId) ?? [];
          const selected = classTeachers.find((row) => row.primary) ?? classTeachers[0];
          if (selected?.sourcedId !== enrollment.sourcedId) continue;
          if (user.role !== "TEACHER") throw new Error("Teacher enrollment references a non-teacher user");
          await writes.class.update({ where: { id: classId }, data: { teacherId: user.userId } });
        }
        successCount += 1;
      } catch (error) {
        issues.push({ entity: "enrollment", sourcedId: enrollment.sourcedId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const status = successCount === 0 && issues.length > 0 ? "FAILED" : "COMPLETED";
    const summary = {
      kind: "ONEROSTER_1_2_RESULT",
      successCount,
      errorCount: issues.length,
      credentialCount: credentials.length,
      counts: {
        users: payload.rows.users.length,
        classes: payload.rows.classes.length,
        enrollments: payload.rows.enrollments.length,
      },
      errors: issues,
      warnings,
    };
    await prisma.studentImportBatch.update({
      where: { id: batch.id },
      data: {
        status,
        processedRows: batch.totalRows,
        successCount,
        errorCount: issues.length,
        completedAt: new Date(),
        resultSummary: summary as Prisma.InputJsonValue,
        credentialCsv: credentials.length > 0 ? credentialCsv(credentials) : null,
      },
    });
    await Promise.all([
      logAudit({
        userId: batch.createdById,
        schoolId: batch.schoolId,
        action: "admin.interoperability.oneroster.import.completed",
        resourceType: "student_import_batch",
        resourceId: batch.id,
        details: { status, successCount, errorCount: issues.length, credentialCount: credentials.length },
      }),
      logLearningEvent({
        schoolId: batch.schoolId,
        userId: batch.createdById,
        actor: { type: "user", id: batch.createdById, role: "ADMIN" },
        target: { type: "student_import_batch", id: batch.id },
        eventType: "oneroster.import.completed",
        source: "interoperability",
        metadata: { status, successCount, errorCount: issues.length },
      }),
    ]);
    return {
      status,
      successCount,
      errorCount: issues.length,
      hasCredentials: credentials.length > 0,
      warnings,
    };
  } catch (error) {
    await prisma.studentImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        processedRows: 0,
        errorCount: batch.totalRows,
        completedAt: new Date(),
        resultSummary: {
          kind: "ONEROSTER_1_2_RESULT",
          successCount: 0,
          errorCount: batch.totalRows,
          errors: [{ entity: "batch", sourcedId: batch.id, message: error instanceof Error ? error.message : String(error) }],
        },
      },
    });
    throw error;
  } finally {
    await disconnect();
  }
}
