import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/auth";

type PolicyConfigJson = Record<string, unknown>;
const POLICY_LOOKUP_TIMEOUT_MS = 250;

const DEFAULT_POLICIES = {
  EXAM_SUBMISSION: {
    maxGraceMinutes: 5,
    minDurationSeconds: 30,
    maxTabSwitchesBeforeFlag: 3,
    blockWhenTimeExceeded: false,
  },
  CURRICULUM_APPROVAL: {
    requireActiveVersionForPublish: true,
    moeOverrideRequiredForArchive: true,
  },
  ATTENDANCE_COMPLIANCE: {
    maxRetroDays: 7,
  },
} as const;
const policyPrisma = prisma as typeof prisma & {
  policyConfig: typeof prisma extends object ? any : never;
  policyOverride: typeof prisma extends object ? any : never;
  curriculumVersion: typeof prisma extends object ? any : never;
};

function getPolicyDelegates() {
  const unsafe = policyPrisma as any;
  return {
    policyConfig: typeof unsafe.policyConfig?.findMany === "function" ? unsafe.policyConfig : null,
    policyOverride: typeof unsafe.policyOverride?.findFirst === "function" ? unsafe.policyOverride : null,
    curriculumVersion: typeof unsafe.curriculumVersion?.findFirst === "function" ? unsafe.curriculumVersion : null,
  };
}

function mergePolicies(base: PolicyConfigJson, patch: unknown): PolicyConfigJson {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return base;
  }
  return { ...base, ...(patch as PolicyConfigJson) };
}

async function withPolicyLookupTimeout<T>(task: Promise<T>): Promise<T | null> {
  return Promise.race([
    task,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), POLICY_LOOKUP_TIMEOUT_MS);
    }),
  ]);
}

function isMissingPolicyTableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  return (
    (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2021") ||
    message.includes("PolicyConfig") ||
    message.includes("PolicyOverride") ||
    message.includes("CurriculumVersion") ||
    message.includes("does not exist")
  );
}

async function loadEffectivePolicy(
  policyKey: keyof typeof DEFAULT_POLICIES,
  options: { districtId?: string | null; schoolId?: string | null }
) {
  const delegates = getPolicyDelegates();
  let entries: Array<{ config: unknown; scope: "NATIONAL" | "DISTRICT" | "SCHOOL" }> = [];
  if (delegates.policyConfig) {
    try {
      const rawEntries = await withPolicyLookupTimeout(delegates.policyConfig.findMany({
        where: {
          policyKey,
          isActive: true,
          OR: [
            { scope: "NATIONAL" },
            ...(options.districtId ? [{ scope: "DISTRICT", districtId: options.districtId }] : []),
            ...(options.schoolId ? [{ scope: "SCHOOL", schoolId: options.schoolId }] : []),
          ],
        },
        orderBy: [{ createdAt: "asc" }],
        select: {
          config: true,
          scope: true,
        },
      }));
      entries = Array.isArray(rawEntries) ? rawEntries : [];
    } catch (error) {
      if (!isMissingPolicyTableError(error)) {
        throw error;
      }
    }
  }

  let effective = { ...DEFAULT_POLICIES[policyKey] } as PolicyConfigJson;
  const rank = { NATIONAL: 1, DISTRICT: 2, SCHOOL: 3 } as const;
  for (const entry of entries.sort((left, right) => rank[left.scope] - rank[right.scope])) {
    effective = mergePolicies(effective, entry.config);
  }

  let override: { overrideData: unknown } | null = null;
  if (delegates.policyOverride) {
    try {
      const rawOverride = await withPolicyLookupTimeout(delegates.policyOverride.findFirst({
        where: {
          policyKey,
          AND: [
            {
              OR: [
                ...(options.schoolId ? [{ schoolId: options.schoolId }] : []),
                ...(options.districtId ? [{ districtId: options.districtId }] : []),
                { districtId: null, schoolId: null },
              ],
            },
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { overrideData: true },
      }));
      override =
        rawOverride && typeof rawOverride === "object" && "overrideData" in rawOverride
          ? (rawOverride as { overrideData: unknown })
          : null;
    } catch (error) {
      if (!isMissingPolicyTableError(error)) {
        throw error;
      }
    }
  }

  return mergePolicies(effective, override?.overrideData);
}

export async function validateExamSubmission(input: {
  user: SessionUser;
  schoolId?: string | null;
  districtId?: string | null;
  startedAt: Date;
  submittedAt: Date;
  examTimeLimitMinutes?: number | null;
  tabSwitchCount: number;
}) {
  const policy = await loadEffectivePolicy("EXAM_SUBMISSION", {
    schoolId: input.schoolId ?? null,
    districtId: input.districtId ?? null,
  });

  const durationSeconds = Math.max(0, Math.round((input.submittedAt.getTime() - input.startedAt.getTime()) / 1000));
  const minDurationSeconds = Number(policy.minDurationSeconds ?? 30);
  const maxGraceMinutes = Number(policy.maxGraceMinutes ?? 5);
  const blockWhenTimeExceeded = Boolean(policy.blockWhenTimeExceeded ?? true);
  const maxTabSwitchesBeforeFlag = Number(policy.maxTabSwitchesBeforeFlag ?? 3);

  const flags: string[] = [];
  if (durationSeconds < minDurationSeconds) {
    flags.push("suspicious_duration");
  }
  if (input.tabSwitchCount >= maxTabSwitchesBeforeFlag) {
    flags.push("policy_tab_switch_threshold");
  }
  const allowedDurationSeconds =
    ((input.examTimeLimitMinutes ?? 0) * 60) + (maxGraceMinutes * 60);

  if (blockWhenTimeExceeded && input.examTimeLimitMinutes != null && durationSeconds > allowedDurationSeconds) {
    throw Object.assign(new Error("Exam submission rejected by policy"), { status: 409 });
  }

  return { durationSeconds, flags, policy };
}

export async function validateCurriculumApproval(input: {
  schoolId?: string | null;
  districtId?: string | null;
  nextStatus: "ACTIVE" | "ARCHIVED" | "published";
}) {
  const policy = await loadEffectivePolicy("CURRICULUM_APPROVAL", {
    schoolId: input.schoolId ?? null,
    districtId: input.districtId ?? null,
  });

  if (input.nextStatus === "published" && Boolean(policy.requireActiveVersionForPublish ?? true)) {
    const delegates = getPolicyDelegates();
    if (delegates.curriculumVersion) {
      try {
        const activeVersion = await withPolicyLookupTimeout(delegates.curriculumVersion.findFirst({
          where: { status: "ACTIVE" },
          select: { id: true },
        }));
        const anyVersion = await withPolicyLookupTimeout(delegates.curriculumVersion.findFirst({
          select: { id: true },
        }));
        if (anyVersion && !activeVersion) {
          throw Object.assign(new Error("No active curriculum version is available for publishing"), { status: 409 });
        }
      } catch (error) {
        if (!isMissingPolicyTableError(error)) {
          throw error;
        }
      }
    }
  }

  return { policy };
}

export async function validateAttendanceCompliance(input: {
  schoolId?: string | null;
  districtId?: string | null;
  attendanceDate: Date;
}) {
  const policy = await loadEffectivePolicy("ATTENDANCE_COMPLIANCE", {
    schoolId: input.schoolId ?? null,
    districtId: input.districtId ?? null,
  });

  const maxRetroDays = Number(policy.maxRetroDays ?? 7);
  const ageMs = Date.now() - input.attendanceDate.getTime();
  const maxRetroMs = maxRetroDays * 24 * 60 * 60 * 1000;

  if (ageMs > maxRetroMs) {
    throw Object.assign(new Error("Attendance update exceeds policy backfill window"), { status: 409 });
  }

  return { policy };
}
