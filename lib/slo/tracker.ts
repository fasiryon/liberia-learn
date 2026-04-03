import { prisma } from "@/lib/db";
import { SLO_TARGETS, SLO_WINDOW_HOURS, type SloService, type SloSummaryStatus } from "@/lib/slo/definitions";

type SloEventInput = {
  service: SloService;
  success: boolean;
  latencyMs: number;
  schoolId?: string | null;
};

type ServiceStatus = {
  service: SloService;
  current: number;
  target: number;
  p95LatencyMs: number;
  status: SloSummaryStatus;
  totalEvents: number;
  successfulEvents: number;
};

type SloStatusResult = {
  login: ServiceStatus;
  tutor: ServiceStatus;
  submit: ServiceStatus;
  export: ServiceStatus;
  dbQueryP95Ms: {
    current: number;
    target: number;
    status: SloSummaryStatus;
  };
  aiResponseP95Ms: {
    current: number;
    target: number;
    status: SloSummaryStatus;
  };
  timestamp: string;
};

const SERVICE_TARGETS: Record<SloService, number> = {
  login: SLO_TARGETS.LOGIN_SUCCESS_RATE,
  tutor: SLO_TARGETS.TUTOR_RESPONSE_SUCCESS,
  submit: SLO_TARGETS.ASSIGNMENT_SUBMIT_SUCCESS,
  export: SLO_TARGETS.EXPORT_GENERATION_SUCCESS,
};

function getSinceDate() {
  return new Date(Date.now() - SLO_WINDOW_HOURS * 60 * 60 * 1000);
}

function percentile95(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function evaluateSuccessStatus(current: number, target: number): SloSummaryStatus {
  if (current >= target) return "healthy";
  if (current >= Math.max(0, target - 0.03)) return "degraded";
  return "critical";
}

function evaluateLatencyStatus(current: number, target: number): SloSummaryStatus {
  if (current <= target) return "healthy";
  if (current <= Math.ceil(target * 1.25)) return "degraded";
  return "critical";
}

function buildServiceStatus(service: SloService, events: Array<{ success: boolean; latencyMs: number }>): ServiceStatus {
  const totalEvents = events.length;
  const successfulEvents = events.filter((event) => event.success).length;
  const current = totalEvents === 0 ? 1 : successfulEvents / totalEvents;
  const target = SERVICE_TARGETS[service];
  const p95LatencyMs = percentile95(events.map((event) => event.latencyMs));

  return {
    service,
    current,
    target,
    p95LatencyMs,
    status: evaluateSuccessStatus(current, target),
    totalEvents,
    successfulEvents,
  };
}

export function recordSloEvent(input: SloEventInput) {
  const latencyMs = Number.isFinite(input.latencyMs) ? Math.max(0, Math.round(input.latencyMs)) : 0;
  const sloEventModel = (prisma as typeof prisma & {
    sloEvent?: { create?: (args: unknown) => Promise<unknown> };
  }).sloEvent;

  if (!sloEventModel?.create) {
    return Promise.resolve(null);
  }

  return sloEventModel.create({
    data: {
      service: input.service,
      success: input.success,
      latencyMs,
      schoolId: input.schoolId ?? null,
    },
  }).catch(() => null);
}

export async function getSloStatus(): Promise<SloStatusResult> {
  const since = getSinceDate();
  const sloEventModel = (prisma as typeof prisma & {
    sloEvent?: { findMany?: (args: unknown) => Promise<Array<{ service: SloService; success: boolean; latencyMs: number }>> };
  }).sloEvent;
  const events = sloEventModel?.findMany
    ? await sloEventModel.findMany({
        where: { createdAt: { gte: since } },
        select: {
          service: true,
          success: true,
          latencyMs: true,
        },
      })
    : [];

  const login = buildServiceStatus("login", events.filter((event) => event.service === "login"));
  const tutor = buildServiceStatus("tutor", events.filter((event) => event.service === "tutor"));
  const submit = buildServiceStatus("submit", events.filter((event) => event.service === "submit"));
  const exportStatus = buildServiceStatus("export", events.filter((event) => event.service === "export"));

  return {
    login,
    tutor,
    submit,
    export: exportStatus,
    dbQueryP95Ms: {
      current: 0,
      target: SLO_TARGETS.DB_QUERY_P95_MS,
      status: "healthy",
    },
    aiResponseP95Ms: {
      current: tutor.p95LatencyMs,
      target: SLO_TARGETS.AI_RESPONSE_P95_MS,
      status: evaluateLatencyStatus(tutor.p95LatencyMs, SLO_TARGETS.AI_RESPONSE_P95_MS),
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getSloSummary() {
  const status = await getSloStatus();
  return {
    login: status.login.status,
    tutor: status.tutor.status,
    submit: status.submit.status,
    export: status.export.status,
  } as const;
}
