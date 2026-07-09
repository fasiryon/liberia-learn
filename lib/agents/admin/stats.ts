import { prisma } from "@/lib/db";
import { listAgents } from "@/lib/agents/registry";
import { getAllControls } from "@/lib/agents/control";
import { isAgentEnabled } from "@/lib/agents/flags";
import { dayKeyUTC } from "@/lib/agents/costAccounting";
import type { AgentRole } from "@/lib/agents/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AgentStatRow {
  name: string;
  description: string;
  version: string;
  rolesAllowed: AgentRole[];
  featureFlag: string;
  envEnabled: boolean;
  override: boolean | null;
  effectiveEnabled: boolean;
  invocationCount: number;
  costThisWeekUSD: number;
}

export async function listAgentsWithStats(now: Date = new Date()): Promise<AgentStatRow[]> {
  const weekStart = new Date(dayKeyUTC(now).getTime() - 6 * DAY_MS);
  const [counts, weekCostRows, controls] = await Promise.all([
    prisma.agentInvocation.groupBy({ by: ["agentName"], _count: { _all: true } }),
    prisma.agentCostAccounting.findMany({ where: { date: { gte: weekStart } } }),
    getAllControls(),
  ]);

  const countByAgent = new Map<string, number>();
  for (const c of counts as Array<{ agentName: string; _count: { _all: number } }>) {
    countByAgent.set(c.agentName, c._count._all);
  }
  const weekCostByAgent = new Map<string, number>();
  for (const r of weekCostRows as Array<{ agentName: string; totalLlmCostUSD: number }>) {
    weekCostByAgent.set(r.agentName, (weekCostByAgent.get(r.agentName) ?? 0) + r.totalLlmCostUSD);
  }

  return listAgents().map((a) => {
    const envEnabled = isAgentEnabled(a.featureFlag);
    const override = controls[a.name] ?? null;
    return {
      name: a.name,
      description: a.description,
      version: a.version,
      rolesAllowed: a.rolesAllowed,
      featureFlag: a.featureFlag,
      envEnabled,
      override,
      effectiveEnabled: override !== null ? override : envEnabled,
      invocationCount: countByAgent.get(a.name) ?? 0,
      costThisWeekUSD: weekCostByAgent.get(a.name) ?? 0,
    };
  });
}

export interface CostDashboard {
  perAgent: Array<{ agentName: string; dailyUSD: number; weeklyUSD: number; monthlyUSD: number; invocations: number }>;
  trend: Array<{ date: string; costPerInvocation: number }>;
  topUsers: Array<{ userId: string; costUSD: number }>;
}

export async function costDashboard(now: Date = new Date()): Promise<CostDashboard> {
  const today = dayKeyUTC(now);
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const monthStart = new Date(today.getTime() - 29 * DAY_MS);

  const [rows, userRows] = await Promise.all([
    prisma.agentCostAccounting.findMany({ where: { date: { gte: monthStart } } }),
    prisma.agentInvocation.groupBy({
      by: ["userId"],
      _sum: { llmCostUSD: true },
      where: { createdAt: { gte: monthStart }, userId: { not: null } },
      orderBy: { _sum: { llmCostUSD: "desc" } },
      take: 10,
    }),
  ]);

  type Row = { agentName: string; date: Date; totalLlmCostUSD: number; totalInvocations: number };
  const perAgentMap = new Map<string, { dailyUSD: number; weeklyUSD: number; monthlyUSD: number; invocations: number }>();
  const trendMap = new Map<string, { cost: number; inv: number }>();

  for (const r of rows as Row[]) {
    const cur = perAgentMap.get(r.agentName) ?? { dailyUSD: 0, weeklyUSD: 0, monthlyUSD: 0, invocations: 0 };
    cur.monthlyUSD += r.totalLlmCostUSD;
    cur.invocations += r.totalInvocations;
    const d = dayKeyUTC(r.date);
    if (d.getTime() >= weekStart.getTime()) cur.weeklyUSD += r.totalLlmCostUSD;
    if (d.getTime() === today.getTime()) cur.dailyUSD += r.totalLlmCostUSD;
    perAgentMap.set(r.agentName, cur);

    const key = d.toISOString().slice(0, 10);
    const t = trendMap.get(key) ?? { cost: 0, inv: 0 };
    t.cost += r.totalLlmCostUSD;
    t.inv += r.totalInvocations;
    trendMap.set(key, t);
  }

  const perAgent = Array.from(perAgentMap.entries()).map(([agentName, v]) => ({
    agentName,
    dailyUSD: v.dailyUSD,
    weeklyUSD: v.weeklyUSD,
    monthlyUSD: v.monthlyUSD,
    invocations: v.invocations,
  }));
  const trend = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, costPerInvocation: v.inv > 0 ? v.cost / v.inv : 0 }));
  const topUsers = (userRows as Array<{ userId: string; _sum: { llmCostUSD: number | null } }>).map((u) => ({
    userId: u.userId,
    costUSD: u._sum.llmCostUSD ?? 0,
  }));

  return { perAgent, trend, topUsers };
}

export interface TriggerMonitorRow {
  agentName: string;
  total: number;
  success: number;
  successRate: number;
}

export async function triggerMonitor(now: Date = new Date()): Promise<TriggerMonitorRow[]> {
  const monthStart = new Date(dayKeyUTC(now).getTime() - 29 * DAY_MS);
  const rows = await prisma.agentInvocation.groupBy({
    by: ["agentName", "status"],
    _count: { _all: true },
    where: { triggeredBy: "EVENT", createdAt: { gte: monthStart } },
  });

  const byAgent = new Map<string, { total: number; success: number }>();
  for (const r of rows as Array<{ agentName: string; status: string; _count: { _all: number } }>) {
    const cur = byAgent.get(r.agentName) ?? { total: 0, success: 0 };
    cur.total += r._count._all;
    if (r.status === "SUCCESS") cur.success += r._count._all;
    byAgent.set(r.agentName, cur);
  }

  return Array.from(byAgent.entries()).map(([agentName, v]) => ({
    agentName,
    total: v.total,
    success: v.success,
    successRate: v.total > 0 ? v.success / v.total : 0,
  }));
}
