import { getRuntimeHealthSummary } from "@/lib/autonomous/runtime/runtimeHealthService";
import { getRuntimeMetrics } from "@/lib/autonomous/runtime/runtimeMetricsService";
import { checkBackpressure } from "@/lib/autonomous/runtime/runtimeBackpressureService";
import { getWorkerStatus, releaseExpiredLocks } from "@/lib/autonomous/runtime/autonomousWorkerService";
import { getSchedulerStatus } from "@/lib/autonomous/runtime/autonomousSchedulerService";
import type { RuntimeHealthSummary, RuntimeMetricsSummary, BackpressureResult } from "@/lib/autonomous/runtime/types";

export type RuntimeOverview = {
  health: RuntimeHealthSummary;
  metrics: RuntimeMetricsSummary;
  backpressure: BackpressureResult;
  workerStatus: Awaited<ReturnType<typeof getWorkerStatus>>;
  schedulerStatus: Awaited<ReturnType<typeof getSchedulerStatus>>;
};

export async function getRuntimeOverview(input: {
  schoolId?: string | null;
} = {}): Promise<RuntimeOverview> {
  const [health, metrics, backpressure, workerStatus, schedulerStatus] = await Promise.all([
    getRuntimeHealthSummary(input),
    getRuntimeMetrics(),
    checkBackpressure(),
    getWorkerStatus(input),
    getSchedulerStatus(),
  ]);

  return { health, metrics, backpressure, workerStatus, schedulerStatus };
}

export async function runRuntimeMaintenance(input: {
  dryRun?: boolean;
} = {}): Promise<{ locksReleased: number }> {
  const locks = await releaseExpiredLocks({ dryRun: input.dryRun });
  return { locksReleased: locks.released };
}
