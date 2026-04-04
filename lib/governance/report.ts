import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export type GovernanceReportPeriod = "7d" | "30d" | "90d";

type GovernanceUser = {
  id: string;
  role: string;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

const PERIOD_TO_DAYS: Record<GovernanceReportPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const SENSITIVE_ACTIONS = new Set([
  "admin.teachers.created",
  "admin.teachers.deactivated",
  "admin.teachers.updated",
  "admin.teachers.password_reset",
  "admin.students.created",
  "admin.guardian-link.created",
  "curriculum.approved",
  "curriculum.rejected",
  "exam.published",
  "school.settings.update",
  "platform.security.transfer",
  "platform.security.accept",
  "platform.security.demote",
]);

function isAdminGovernanceAction(action: string) {
  return (
    action.startsWith("admin.") ||
    action.startsWith("export.") ||
    action.startsWith("platform.security.") ||
    action === "school.settings.update" ||
    action === "exam.published" ||
    action.startsWith("curriculum.")
  );
}

function isSensitiveAction(action: string) {
  return SENSITIVE_ACTIONS.has(action);
}

function subtractDays(days: number) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);
  return from;
}

function sortByCountDesc<T extends { count: number }>(entries: T[]) {
  return entries.sort((left, right) => right.count - left.count);
}

export async function buildGovernanceReport({
  viewer,
  period = "30d",
  schoolId,
}: {
  viewer: GovernanceUser;
  period?: GovernanceReportPeriod;
  schoolId?: string | null;
}) {
  const effectiveSchoolId = schoolId ?? null;
  const from = subtractDays(PERIOD_TO_DAYS[period]);
  const auditWhere = {
    createdAt: { gte: from },
    ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
  };
  const exportWhere = {
    createdAt: { gte: from },
    ...(effectiveSchoolId ? { scopeId: effectiveSchoolId } : {}),
  };
  const aiWhere = {
    timestamp: { gte: from },
    ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
  };
  const adminRoleWhere = effectiveSchoolId
    ? { schoolId: effectiveSchoolId, role: { in: [Role.ADMIN, Role.MOE_OFFICIAL] } }
    : { role: { in: [Role.ADMIN, Role.MOE_OFFICIAL] } };

  const [
    auditCount,
    exportCount,
    aiCount,
    adminCount,
    schoolCount,
    exportRows,
    aiRows,
    auditRows,
    sensitiveRows,
  ] = await Promise.all([
    prisma.auditLog.count({ where: auditWhere }),
    prisma.exportRecord.count({ where: exportWhere }),
    prisma.aiInteractionLog.count({ where: aiWhere }),
    prisma.user.count({ where: adminRoleWhere }),
    effectiveSchoolId
      ? prisma.school.count({ where: { id: effectiveSchoolId } })
      : prisma.school.count(),
    prisma.exportRecord.findMany({
      where: exportWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        exportType: true,
        scope: true,
        scopeId: true,
        format: true,
        createdAt: true,
      },
    }),
    prisma.aiInteractionLog.findMany({
      where: aiWhere,
      orderBy: { timestamp: "desc" },
      take: 500,
      select: {
        feature: true,
        schoolId: true,
        estimatedCostUSD: true,
        hadFallback: true,
      },
    }),
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        action: true,
        schoolId: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        ...auditWhere,
        action: { in: Array.from(SENSITIVE_ACTIONS) },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        schoolId: true,
        ipAddress: true,
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const exportTypeCounts = new Map<string, number>();
  for (const row of exportRows) {
    exportTypeCounts.set(row.exportType, (exportTypeCounts.get(row.exportType) ?? 0) + 1);
  }

  const aiFeatureStats = new Map<
    string,
    { feature: string; count: number; estimatedCostUsd: number; fallbackCount: number }
  >();
  const aiSchoolStats = new Map<string, { schoolId: string; interactions: number; estimatedCostUsd: number }>();
  for (const row of aiRows) {
    const featureKey = row.feature?.trim() || "unknown";
    const currentFeature = aiFeatureStats.get(featureKey) ?? {
      feature: featureKey,
      count: 0,
      estimatedCostUsd: 0,
      fallbackCount: 0,
    };
    currentFeature.count += 1;
    currentFeature.estimatedCostUsd += row.estimatedCostUSD ?? 0;
    if (row.hadFallback) currentFeature.fallbackCount += 1;
    aiFeatureStats.set(featureKey, currentFeature);

    const schoolKey = row.schoolId ?? "unscoped";
    const currentSchool = aiSchoolStats.get(schoolKey) ?? {
      schoolId: schoolKey,
      interactions: 0,
      estimatedCostUsd: 0,
    };
    currentSchool.interactions += 1;
    currentSchool.estimatedCostUsd += row.estimatedCostUSD ?? 0;
    aiSchoolStats.set(schoolKey, currentSchool);
  }

  const adminActionCounts = new Map<string, number>();
  const touchedSchoolIds = new Set<string>();
  for (const row of auditRows) {
    if (row.schoolId) touchedSchoolIds.add(row.schoolId);
    if (!isAdminGovernanceAction(row.action)) continue;
    adminActionCounts.set(row.action, (adminActionCounts.get(row.action) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    period,
    from: from.toISOString(),
    scope: effectiveSchoolId ? "school" : "national",
    schoolId: effectiveSchoolId,
    overview: {
      auditEvents: auditCount,
      exportsGenerated: exportCount,
      aiActions: aiCount,
      sensitiveActions: sensitiveRows.length,
      activeAdmins: adminCount,
      affectedSchools: effectiveSchoolId ? schoolCount : touchedSchoolIds.size || schoolCount,
    },
    exportActivity: {
      total: exportCount,
      byType: sortByCountDesc(
        Array.from(exportTypeCounts.entries()).map(([exportType, count]) => ({
          exportType,
          count,
        }))
      ),
      recent: exportRows.slice(0, 10),
    },
    adminActions: {
      total: Array.from(adminActionCounts.values()).reduce((sum, count) => sum + count, 0),
      byAction: sortByCountDesc(
        Array.from(adminActionCounts.entries()).map(([action, count]) => ({
          action,
          count,
          sensitive: isSensitiveAction(action),
        }))
      ),
    },
    aiActions: {
      total: aiCount,
      byFeature: sortByCountDesc(
        Array.from(aiFeatureStats.values()).map((entry) => ({
          feature: entry.feature,
          count: entry.count,
          estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(4)),
          fallbackRatePct:
            entry.count > 0 ? Math.round((entry.fallbackCount / entry.count) * 100) : 0,
        }))
      ),
      topSchools: Array.from(aiSchoolStats.values())
        .sort((left, right) => right.interactions - left.interactions)
        .slice(0, 5),
    },
    sensitiveActionLog: sensitiveRows,
  };
}
