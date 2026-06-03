import { prisma } from "@/lib/db";

export type ErrorSummary = {
  totalErrors24h: number;
  topKinds: { kind: string; count: number }[];
  sentryConfigured: boolean;
  sentryProjectUrl: string;
};

export async function getErrorRates24h(): Promise<ErrorSummary> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sentryOrg = process.env.SENTRY_ORG ?? "liberialearn";
  const sentryProject = process.env.SENTRY_PROJECT ?? "liberialearn";
  const sentryConfigured = Boolean(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  );

  try {
    const [totalErrors24h, topKindsRaw] = await Promise.all([
      prisma.metricEvent.count({
        where: { createdAt: { gte: since }, severity: "error" },
      }),
      prisma.metricEvent.groupBy({
        by: ["kind"],
        where: { createdAt: { gte: since }, severity: "error" },
        _count: { kind: true },
        orderBy: { _count: { kind: "desc" } },
        take: 5,
      }),
    ]);

    const topKinds = topKindsRaw.map((r) => ({
      kind: r.kind,
      count: r._count.kind,
    }));

    return {
      totalErrors24h,
      topKinds,
      sentryConfigured,
      sentryProjectUrl: sentryConfigured
        ? `https://sentry.io/organizations/${sentryOrg}/projects/${sentryProject}/`
        : "",
    };
  } catch {
    return {
      totalErrors24h: 0,
      topKinds: [],
      sentryConfigured,
      sentryProjectUrl: "",
    };
  }
}
