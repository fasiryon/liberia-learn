import { prisma } from "@/lib/db";
import type { ReportScope } from "@/lib/reporting/scope";

export type TrainingTotals = {
  teachers: number;
  modules: number;
  assigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
};

export type TrainingModuleBreakdown = {
  moduleId: string;
  code: string;
  title: string;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
};

export type TrainingSummaryDTO = {
  scope: ReportScope;
  scopeId: string | null;
  pilotOnly: boolean;
  totals: TrainingTotals;
  modules: TrainingModuleBreakdown[];
};

function getScopeFilter(scope: ReportScope, scopeId: string | null) {
  if (scope === "school") {
    return { schoolId: scopeId ?? "" };
  }
  if (scope === "county") {
    return { school: { county: scopeId ?? "" } };
  }
  if (scope === "district") {
    return { school: { district: scopeId ?? "" } };
  }
  return {};
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export async function getTrainingSummary({
  scope,
  scopeId,
  pilotOnly,
}: {
  scope: ReportScope;
  scopeId: string | null;
  pilotOnly: boolean;
}): Promise<TrainingSummaryDTO> {
  const moduleList = await prisma.trainingModule.findMany({
    where: { pilotOnly },
    select: { id: true, code: true, title: true },
    orderBy: { code: "asc" },
  });

  const progress = await prisma.teacherTrainingProgress.findMany({
    where: {
      pilotOnly,
      module: { pilotOnly },
      teacher: {
        role: "TEACHER",
        ...getScopeFilter(scope, scopeId),
      },
    },
    select: {
      moduleId: true,
      status: true,
      teacherId: true,
    },
  });

  const teacherSet = new Set<string>();
  for (const row of progress) teacherSet.add(row.teacherId);

  const perModule = new Map<string, TrainingModuleBreakdown>();
  for (const mod of moduleList) {
    perModule.set(mod.id, {
      moduleId: mod.id,
      code: mod.code,
      title: mod.title,
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      completionRate: 0,
    });
  }

  for (const row of progress) {
    const entry = perModule.get(row.moduleId);
    if (!entry) continue;
    entry.total += 1;
    if (row.status === "COMPLETED") entry.completed += 1;
    else if (row.status === "IN_PROGRESS") entry.inProgress += 1;
    else entry.notStarted += 1;
  }

  const modules = Array.from(perModule.values()).map((m) => ({
    ...m,
    completionRate: safeRate(m.completed, m.total),
  }));

  const totals = modules.reduce(
    (acc, m) => {
      acc.assigned += m.total;
      acc.completed += m.completed;
      acc.inProgress += m.inProgress;
      acc.notStarted += m.notStarted;
      return acc;
    },
    {
      teachers: teacherSet.size,
      modules: modules.length,
      assigned: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      completionRate: 0,
    }
  );

  totals.completionRate = safeRate(totals.completed, totals.assigned);

  return {
    scope,
    scopeId,
    pilotOnly,
    totals,
    modules,
  };
}


