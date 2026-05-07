import crypto from "crypto";

import { Prisma, type CertificateType } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendCertificateAwarded } from "@/lib/email";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

const CERTIFICATE_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CERTIFICATE_CODE_LENGTH = 8;
const RANDOM_BYTE_LIMIT =
  256 - (256 % CERTIFICATE_CODE_CHARSET.length);

type AwardCertificateInput = {
  studentId: string;
  studentUserId: string;
  schoolId: string;
  classId: string;
  subject: string;
  type: CertificateType;
  referenceId: string;
  title: string;
  actingUserId: string;
  contentId?: string | null;
  lessonId?: string | null;
};

type AwardLessonQuizCertificatesInput = {
  studentId: string;
  studentUserId: string;
  schoolId: string;
  classId: string;
  subject: string;
  scheduledWorkId: string;
  contentId: string;
  lessonTitle: string;
  actingUserId: string;
  quizScore: number;
};

export type StudentCertificateRecord = {
  id: string;
  type: CertificateType;
  referenceId: string;
  title: string;
  subject: string;
  awardedAt: string;
  certificateCode: string;
  studentName: string;
  canvaUrl: string | null;
};

export type CertificateVerificationRecord = {
  studentFirstName: string;
  completed: string;
  awardedAt: string;
  certificateCode: string;
};

function formatSubjectLabel(subject: string): string {
  return subject.replace(/_/g, " ");
}

function extractFirstName(fullName: string | null | undefined): string {
  const normalized = fullName?.trim();
  if (!normalized) {
    return "Student";
  }

  return normalized.split(/\s+/)[0] || "Student";
}

function generateCertificateCode(): string {
  let code = "";

  while (code.length < CERTIFICATE_CODE_LENGTH) {
    const bytes = crypto.randomBytes(CERTIFICATE_CODE_LENGTH);
    for (const byte of bytes) {
      if (byte >= RANDOM_BYTE_LIMIT) {
        continue;
      }

      code += CERTIFICATE_CODE_CHARSET[byte % CERTIFICATE_CODE_CHARSET.length];
      if (code.length === CERTIFICATE_CODE_LENGTH) {
        break;
      }
    }
  }

  return code;
}

function isUniqueConstraintError(
  error: unknown,
  fieldName?: string
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (!fieldName ||
      String((error.meta as Record<string, unknown> | undefined)?.target).includes(
        fieldName
      ))
  );
}

async function createCertificateWithCode(input: {
  studentId: string;
  type: CertificateType;
  referenceId: string;
}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.certificate.create({
        data: {
          studentId: input.studentId,
          type: input.type,
          referenceId: input.referenceId,
          certificateCode: generateCertificateCode(),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error, "certificateCode")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("certificate_code_generation_failed");
}

async function awardCertificate(input: AwardCertificateInput) {
  const existing = await prisma.certificate.findUnique({
    where: {
      studentId_type_referenceId: {
        studentId: input.studentId,
        type: input.type,
        referenceId: input.referenceId,
      },
    },
    select: {
      id: true,
      certificateCode: true,
      awardedAt: true,
    },
  });

  if (existing) {
    return { certificateId: existing.id, created: false };
  }

  let certificate;
  try {
    certificate = await createCertificateWithCode({
      studentId: input.studentId,
      type: input.type,
      referenceId: input.referenceId,
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "studentId")) {
      const duplicate = await prisma.certificate.findUnique({
        where: {
          studentId_type_referenceId: {
            studentId: input.studentId,
            type: input.type,
            referenceId: input.referenceId,
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        return { certificateId: duplicate.id, created: false };
      }
    }

    throw error;
  }

  const readableType =
    input.type === "LESSON" ? "Lesson Certificate" : "Subject Certificate";
  const notificationBody =
    input.type === "LESSON"
      ? `You earned a Lesson Certificate for ${input.title}.`
      : `You earned a Subject Certificate for ${input.title}.`;

  await prisma.notificationLog.create({
    data: {
      userId: input.studentUserId,
      channel: "in_app",
      recipient: input.studentUserId,
      subject: readableType,
      body: notificationBody,
      status: "sent",
    },
  });

  const studentUserModel = (prisma as any).user;
  const studentUser = studentUserModel?.findUnique
    ? await studentUserModel
        .findUnique({
          where: { id: input.studentUserId },
          select: { email: true, name: true },
        })
        .catch(() => null)
    : null;

  if (studentUser?.email && !studentUser.email.endsWith(".local")) {
    const verifyUrl = `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/verify/${certificate.certificateCode}`;
    await sendCertificateAwarded({
      to: studentUser.email,
      studentName: studentUser.name ?? "Student",
      certificateTitle: input.title,
      certificateCode: certificate.certificateCode,
      verifyUrl,
    }).catch(() => null);
  }

  await logAudit({
    userId: input.actingUserId,
    schoolId: input.schoolId,
    action: "student.certificate.awarded",
    resourceType: "certificate",
    resourceId: certificate.id,
    details: {
      certificateType: input.type,
      referenceId: input.referenceId,
      title: input.title,
      subject: input.subject,
      studentId: input.studentId,
    },
  });

  await logLearningEvent({
    schoolId: input.schoolId,
    classId: input.classId,
    userId: input.actingUserId,
    studentId: input.studentId,
    actor: { type: "user", id: input.actingUserId, role: "STUDENT" },
    target: { type: "certificate", id: certificate.id },
    eventType: "student.certificate.awarded",
    source: "/api/student/lessons/[id]/quiz/submit",
    contentId: input.contentId ?? null,
    lessonId: input.lessonId ?? null,
    subject: input.subject,
    metadata: {
      certificateType: input.type,
      referenceId: input.referenceId,
      title: input.title,
    },
  });

  return { certificateId: certificate.id, created: true };
}

export async function awardLessonQuizCertificates(
  input: AwardLessonQuizCertificatesInput
) {
  if (input.quizScore < 0.7) {
    return { lessonAwarded: false, subjectAwarded: false };
  }

  const progress = await prisma.studentProgress.findUnique({
    where: {
      studentId_scheduledWorkId: {
        studentId: input.studentUserId,
        scheduledWorkId: input.scheduledWorkId,
      },
    },
    select: {
      completedAt: true,
    },
  });

  if (!progress?.completedAt) {
    return { lessonAwarded: false, subjectAwarded: false };
  }

  const lessonAward = await awardCertificate({
    studentId: input.studentId,
    studentUserId: input.studentUserId,
    schoolId: input.schoolId,
    classId: input.classId,
    subject: input.subject,
    type: "LESSON",
    referenceId: input.scheduledWorkId,
    title: input.lessonTitle,
    actingUserId: input.actingUserId,
    contentId: input.contentId,
    lessonId: input.scheduledWorkId,
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: input.studentId },
    select: { classId: true },
  });

  const classIds = enrollments.map((enrollment) => enrollment.classId);
  if (classIds.length === 0) {
    return { lessonAwarded: lessonAward.created, subjectAwarded: false };
  }

  const [scheduledWorks, lessonCertificates] = await Promise.all([
    prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        class: { schoolId: input.schoolId },
        content: { subject: input.subject },
      },
      select: { id: true },
    }),
    prisma.certificate.findMany({
      where: {
        studentId: input.studentId,
        type: "LESSON",
      },
      select: { referenceId: true },
    }),
  ]);

  const requiredLessonIds = Array.from(
    new Set(scheduledWorks.map((scheduledWork) => scheduledWork.id))
  );
  const earnedLessonIds = new Set(
    lessonCertificates.map((certificate) => certificate.referenceId)
  );

  const qualifiesForSubjectCertificate =
    requiredLessonIds.length > 0 &&
    requiredLessonIds.every((lessonId) => earnedLessonIds.has(lessonId));

  if (!qualifiesForSubjectCertificate) {
    return { lessonAwarded: lessonAward.created, subjectAwarded: false };
  }

  const subjectAward = await awardCertificate({
    studentId: input.studentId,
    studentUserId: input.studentUserId,
    schoolId: input.schoolId,
    classId: input.classId,
    subject: input.subject,
    type: "SUBJECT",
    referenceId: input.subject,
    title: `${formatSubjectLabel(input.subject)} Subject`,
    actingUserId: input.actingUserId,
  });

  return {
    lessonAwarded: lessonAward.created,
    subjectAwarded: subjectAward.created,
  };
}

export async function listStudentCertificates(
  studentUserId: string
): Promise<StudentCertificateRecord[]> {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });

  if (!student) {
    return [];
  }

  const certificates = await prisma.certificate.findMany({
    where: { studentId: student.id },
    orderBy: { awardedAt: "desc" },
    select: {
      id: true,
      type: true,
      referenceId: true,
      awardedAt: true,
      certificateCode: true,
      canvaUrl: true,
    },
  });

  const lessonReferenceIds = certificates
    .filter((certificate) => certificate.type === "LESSON")
    .map((certificate) => certificate.referenceId);

  const lessonLookupRows =
    lessonReferenceIds.length > 0
      ? await prisma.scheduledWork.findMany({
          where: { id: { in: lessonReferenceIds } },
          select: {
            id: true,
            content: {
              select: {
                contentId: true,
                subject: true,
                payload: true,
              },
            },
          },
        })
      : [];

  const lessonLookup = new Map(
    lessonLookupRows.map((row) => {
      const payload = (row.content.payload ?? {}) as Record<string, unknown>;
      return [
        row.id,
        {
          title: resolveLessonTitle({
            payload,
            subject: row.content.subject,
            fallbackTitle: row.content.contentId,
          }),
          subject: row.content.subject,
        },
      ] as const;
    })
  );

  const studentName = student.user?.name?.trim() || "Student";

  return certificates.map((certificate) => {
    const lessonMeta = lessonLookup.get(certificate.referenceId);
    const title =
      certificate.type === "LESSON"
        ? lessonMeta?.title ?? "Lesson Certificate"
        : `${formatSubjectLabel(certificate.referenceId)} Subject`;
    const subject =
      certificate.type === "LESSON"
        ? lessonMeta?.subject ?? "General"
        : certificate.referenceId;

    return {
      id: certificate.id,
      type: certificate.type,
      referenceId: certificate.referenceId,
      title,
      subject,
      awardedAt: certificate.awardedAt.toISOString(),
      certificateCode: certificate.certificateCode,
      studentName,
      canvaUrl: certificate.canvaUrl ?? null,
    };
  });
}

export async function getCertificateVerification(
  certificateCode: string
): Promise<CertificateVerificationRecord | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateCode },
    select: {
      certificateCode: true,
      type: true,
      referenceId: true,
      awardedAt: true,
      student: {
        select: {
          user: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!certificate) {
    return null;
  }

  let completed = `${formatSubjectLabel(certificate.referenceId)} subject`;
  if (certificate.type === "LESSON") {
    const scheduledWork = await prisma.scheduledWork.findUnique({
      where: { id: certificate.referenceId },
      select: {
        content: {
          select: {
            contentId: true,
            subject: true,
            payload: true,
          },
        },
      },
    });

    if (scheduledWork) {
      const payload = (scheduledWork.content.payload ?? {}) as Record<string, unknown>;
      completed = resolveLessonTitle({
        payload,
        subject: scheduledWork.content.subject,
        fallbackTitle: scheduledWork.content.contentId,
      });
    }
  } else {
    completed = `${formatSubjectLabel(certificate.referenceId)} subject certificate`;
  }

  return {
    studentFirstName: extractFirstName(certificate.student.user?.name),
    completed,
    awardedAt: certificate.awardedAt.toISOString(),
    certificateCode: certificate.certificateCode,
  };
}
