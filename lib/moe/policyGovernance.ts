import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type DirectiveStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "published"
  | "applied"
  | "rejected"
  | "archived";

export type DirectiveTargetScope = "national" | "county" | "district" | "school" | "grade" | "subject";

export type DirectiveTargetFilters = {
  county?: string | null;
  districtId?: string | null;
  schoolId?: string | null;
  grade?: number | null;
  subject?: string | null;
};

const prismaGov = prisma as typeof prisma & {
  moePolicyDirective: any;
  moeDirectiveApplication: any;
};

const ALLOWED_TRANSITIONS: Record<DirectiveStatus, DirectiveStatus[]> = {
  draft: ["pending_review", "archived"],
  pending_review: ["approved", "rejected", "archived"],
  approved: ["published", "archived"],
  published: ["applied", "archived"],
  applied: ["archived"],
  rejected: ["archived"],
  archived: [],
};

function requireTransition(from: DirectiveStatus, to: DirectiveStatus) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw Object.assign(new Error(`Invalid directive transition: ${from} to ${to}`), { status: 409 });
  }
}

function safeFilters(filters: unknown): DirectiveTargetFilters {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return {};
  const raw = filters as Record<string, unknown>;
  const grade = Number(raw.grade);
  return {
    county: typeof raw.county === "string" && raw.county.trim() ? raw.county.trim() : null,
    districtId: typeof raw.districtId === "string" && raw.districtId.trim() ? raw.districtId.trim() : null,
    schoolId: typeof raw.schoolId === "string" && raw.schoolId.trim() ? raw.schoolId.trim() : null,
    grade: Number.isInteger(grade) && grade > 0 ? grade : null,
    subject: typeof raw.subject === "string" && raw.subject.trim() ? raw.subject.trim().toUpperCase() : null,
  };
}

function schoolWhere(scope: DirectiveTargetScope, filters: DirectiveTargetFilters) {
  if (scope === "county" && filters.county) return { county: filters.county };
  if (scope === "district" && filters.districtId) return { districtId: filters.districtId };
  if (scope === "school" && filters.schoolId) return { id: filters.schoolId };
  return {};
}

function classWhere(scope: DirectiveTargetScope, filters: DirectiveTargetFilters) {
  const where: Record<string, unknown> = {};
  if (scope === "grade" && filters.grade) where.gradeLevel = filters.grade;
  if (scope === "subject" && filters.subject) where.subject = filters.subject;
  if (filters.schoolId) where.schoolId = filters.schoolId;
  if (filters.districtId || filters.county) {
    where.School = {
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
      ...(filters.county ? { county: filters.county } : {}),
    };
  }
  return where;
}

export async function createMoeDirective(input: {
  userId: string;
  title: string;
  description: string;
  policyType: string;
  targetScope: DirectiveTargetScope;
  targetFilters?: DirectiveTargetFilters;
  auditMetadata?: Record<string, unknown>;
}) {
  const title = input.title.trim();
  const description = input.description.trim();
  const policyType = input.policyType.trim();
  if (!title || !description || !policyType) {
    throw Object.assign(new Error("title, description, and policyType are required"), { status: 400 });
  }

  const filters = safeFilters(input.targetFilters ?? {});
  const directive = await prismaGov.moePolicyDirective.create({
    data: {
      title,
      description,
      policyType,
      targetScope: input.targetScope,
      targetFilters: filters,
      createdById: input.userId,
      updatedById: input.userId,
      districtId: filters.districtId ?? null,
      schoolId: filters.schoolId ?? null,
      auditMetadata: input.auditMetadata ?? {},
    },
    include: directiveInclude(),
  });

  await auditDirective(input.userId, "moe.directive.created", directive, { status: directive.status });
  return directive;
}

export async function transitionMoeDirective(input: {
  directiveId: string;
  userId: string;
  nextStatus: DirectiveStatus;
  reason?: string | null;
}) {
  const current = await prismaGov.moePolicyDirective.findUnique({
    where: { id: input.directiveId },
    include: { applications: true },
  });
  if (!current) throw Object.assign(new Error("Directive not found"), { status: 404 });

  const currentStatus = current.status as DirectiveStatus;
  requireTransition(currentStatus, input.nextStatus);

  if (input.nextStatus === "applied" && currentStatus !== "published") {
    throw Object.assign(new Error("Directive must be published before it can be applied"), { status: 409 });
  }

  const now = new Date();
  const data: Record<string, unknown> = {
    status: input.nextStatus,
    updatedById: input.userId,
  };
  if (input.nextStatus === "approved") data.approvedById = input.userId;
  if (input.nextStatus === "published") data.publishedAt = now;
  if (input.nextStatus === "applied") data.appliedAt = now;
  if (input.nextStatus === "rejected") data.rejectedAt = now;
  if (input.nextStatus === "archived") data.archivedAt = now;

  const directive = await prismaGov.moePolicyDirective.update({
    where: { id: input.directiveId },
    data,
    include: directiveInclude(),
  });

  if (input.nextStatus === "published") {
    await ensureApplicationRecords(directive.id);
  }
  if (input.nextStatus === "applied") {
    await markDirectiveApplicationsNeedsReview(directive.id);
  }

  await auditDirective(input.userId, `moe.directive.${input.nextStatus}`, directive, {
    from: currentStatus,
    to: input.nextStatus,
    reason: input.reason ?? null,
  });
  return prismaGov.moePolicyDirective.findUnique({ where: { id: directive.id }, include: directiveInclude() });
}

export async function listMoeDirectives() {
  const directives = await prismaGov.moePolicyDirective.findMany({
    include: directiveInclude(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return directives.map(withApplicationSummary);
}

export async function buildCurriculumVersionDriftSummary() {
  const activeVersion = await prismaGov.curriculumVersion.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, versionName: true },
    orderBy: { createdAt: "desc" },
  });

  const [schools, classes, alignedContent] = await Promise.all([
    prisma.school.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, county: true, districtId: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      select: { id: true, schoolId: true, gradeLevel: true, subject: true },
      orderBy: [{ schoolId: "asc" }, { gradeLevel: "asc" }],
    }),
    activeVersion
      ? prisma.curriculumContent.findMany({
          where: { versionId: activeVersion.id, status: { in: ["APPROVED", "published", "approved"] } },
          select: { grade: true, subject: true },
        })
      : Promise.resolve([]),
  ]);

  const alignedKeys = new Set(alignedContent.map((item) => `${item.grade}:${String(item.subject).toUpperCase()}`));
  const classRows = classes.map((classRow) => {
    const key = `${classRow.gradeLevel ?? "unknown"}:${String(classRow.subject).toUpperCase()}`;
    const aligned = classRow.gradeLevel != null && alignedKeys.has(key);
    return {
      classId: classRow.id,
      schoolId: classRow.schoolId,
      grade: classRow.gradeLevel,
      subject: String(classRow.subject),
      status: activeVersion ? (aligned ? "aligned" : "needs_review") : "needs_review",
    };
  });

  const schoolRows = schools.map((school) => {
    const scopedClasses = classRows.filter((row) => row.schoolId === school.id);
    const needsReview = scopedClasses.filter((row) => row.status !== "aligned").length;
    return {
      schoolId: school.id,
      schoolName: school.name,
      county: school.county,
      districtId: school.districtId,
      classCount: scopedClasses.length,
      alignedClasses: scopedClasses.length - needsReview,
      needsReviewClasses: needsReview,
      status: !activeVersion || needsReview > 0 ? "needs_review" : "aligned",
    };
  });

  return {
    activeVersion,
    generatedAt: new Date().toISOString(),
    totals: {
      schools: schoolRows.length,
      classes: classRows.length,
      alignedClasses: classRows.filter((row) => row.status === "aligned").length,
      needsReviewClasses: classRows.filter((row) => row.status !== "aligned").length,
    },
    schools: schoolRows,
    classes: classRows.slice(0, 100),
  };
}

async function ensureApplicationRecords(directiveId: string) {
  const directive = await prismaGov.moePolicyDirective.findUnique({ where: { id: directiveId } });
  if (!directive) return;
  const filters = safeFilters(directive.targetFilters);
  const targetScope = directive.targetScope as DirectiveTargetScope;
  const [schools, classes] = await Promise.all([
    prisma.school.findMany({ where: schoolWhere(targetScope, filters), select: { id: true } }),
    prisma.class.findMany({ where: classWhere(targetScope, filters), select: { id: true, schoolId: true, gradeLevel: true, subject: true } }),
  ]);

  const records =
    targetScope === "grade" || targetScope === "subject"
      ? classes.map((classRow) => ({
          directiveId,
          schoolId: classRow.schoolId,
          classId: classRow.id,
          grade: classRow.gradeLevel ?? filters.grade ?? null,
          subject: String(classRow.subject ?? filters.subject ?? ""),
          status: "needs_review",
          evidence: { source: "published_directive", exactApplicationUnknown: true },
        }))
      : schools.map((school) => ({
          directiveId,
          schoolId: school.id,
          classId: null,
          grade: filters.grade ?? null,
          subject: filters.subject ?? null,
          status: "needs_review",
          evidence: { source: "published_directive", exactApplicationUnknown: true },
        }));

  for (const record of records) {
    await prismaGov.moeDirectiveApplication.upsert({
      where: {
        directiveId_schoolId_classId_grade_subject: {
          directiveId,
          schoolId: record.schoolId,
          classId: record.classId,
          grade: record.grade,
          subject: record.subject,
        },
      },
      create: record,
      update: { status: record.status, evidence: record.evidence },
    });
  }
}

async function markDirectiveApplicationsNeedsReview(directiveId: string) {
  await ensureApplicationRecords(directiveId);
  await prismaGov.moeDirectiveApplication.updateMany({
    where: { directiveId, status: { not: "applied" } },
    data: {
      status: "needs_review",
      failureReason: "Exact application confirmation is unavailable; review required.",
    },
  });
}

function directiveInclude() {
  return {
    createdBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    applications: true,
  };
}

function withApplicationSummary(directive: any) {
  const applications = Array.isArray(directive.applications) ? directive.applications : [];
  return {
    ...directive,
    applicationSummary: {
      total: applications.length,
      applied: applications.filter((item: any) => item.status === "applied").length,
      pending: applications.filter((item: any) => item.status === "pending").length,
      failed: applications.filter((item: any) => item.status === "failed").length,
      needsReview: applications.filter((item: any) => item.status === "needs_review").length,
    },
  };
}

async function auditDirective(userId: string, action: string, directive: any, details: Record<string, unknown>) {
  await logAudit({
    userId,
    action,
    resourceType: "moe_policy_directive",
    resourceId: directive.id,
    schoolId: directive.schoolId ?? null,
    details: {
      title: directive.title,
      policyType: directive.policyType,
      targetScope: directive.targetScope,
      ...details,
    },
  });
}
