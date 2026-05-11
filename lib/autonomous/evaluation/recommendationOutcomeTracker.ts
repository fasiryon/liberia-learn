import { prisma } from "@/lib/db";

export async function getRecommendationPrecisionAnalytics(input: { schoolId?: string | null; detectorId?: string | null } = {}) {
  const where: any = { eventType: "autonomous.evaluation.recorded" };
  if (input.schoolId) where.schoolId = input.schoolId;
  const events = await (prisma as any).learningEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: 1000 });
  const filtered = input.detectorId ? events.filter((event: any) => event.metadata?.detectorId === input.detectorId) : events;
  const total = filtered.length;
  const accepted = filtered.filter((event: any) => ["accepted", "executed", "improved"].includes(event.metadata?.outcome ?? event.status)).length;
  const falsePositives = filtered.filter((event: any) => (event.metadata?.outcome ?? event.status) === "false_positive").length;
  const rejected = filtered.filter((event: any) => (event.metadata?.outcome ?? event.status) === "rejected").length;
  return {
    total,
    accepted,
    rejected,
    falsePositives,
    precision: total ? Number((accepted / total).toFixed(2)) : 0,
    falsePositiveRate: total ? Number((falsePositives / total).toFixed(2)) : 0,
  };
}

