// Numeric budgets for every LiberiaLearn interactive lab (Production Team V1.1, section E).
// Values were researched and LOCKED on 2026-09-28; __tests__/interactive-labs/lab-budgets.test.ts pins them,
// so changing one is an explicit, reviewed edit. Static budgets are enforced in CI from the render list and the
// offline package. Runtime targets (fps, interactive time, memory) can only be certified on TARGET_LOW_DEVICE or
// GPU-backed runs; CI never claims them.
import { buildOfflineManifest } from "../fidelity/boundary";
import { buildRenderList } from "../fidelity/renderList";
import { RENDER_BUDGETS } from "../fidelity/profiles";
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabState } from "../types";

export const LAB_BUDGET_VERSION = "lab-budgets/1.0.0" as const;
export const LAB_BUDGET_LOCKED_ON = "2026-09-28";

/**
 * The device every lab must serve well. Tecno is Liberia's largest phone vendor (StatCounter, Aug 2026: 31.95%),
 * and the Spark Go line is its entry tier. Its GPU scores 9 fps in 3DMark Sling Shot test 1 (UL benchmarks), so on
 * this device LOW (not HIGH) is the profile that must hold its fps target.
 */
export const TARGET_LOW_DEVICE = Object.freeze({
  name: "Tecno Spark Go 2024 (3 GB RAM variant)",
  soc: "Unisoc T606 (2× Cortex-A75 + 6× Cortex-A55 @ 1.6 GHz)",
  gpu: "Mali-G57 MP1",
  ramGB: 3,
  os: "Android 13 (Go edition)",
  display: "6.6\" HD+ 720×1612, 90 Hz",
  browser: "Chrome for Android (current stable)",
  expectedProfile: "LOW" as CapabilityProfile,
  sources: [
    "https://gs.statcounter.com/vendor-market-share/mobile/liberia",
    "https://www.gsmarena.com/tecno_spark_go_2024-12702.php",
    "https://benchmarks.ul.com/hardware/phone/Tecno+Spark+Go+2024+review",
  ],
});

/** Network baseline for load budgets: Alex Russell, "The Performance Inequality Gap, 2026" (9 Mbps down, 100 ms RTT). */
export const TARGET_NETWORK = Object.freeze({ downlinkMbps: 9, rttMs: 100, source: "https://infrequently.org/2025/11/performance-inequality-gap-2026/" });

/** Measured only on TARGET_LOW_DEVICE, real devices or GPU-backed runs; never from software-GL captures. */
export const RUNTIME_TARGETS = Object.freeze({
  /** Sustained fps per profile. Falling below it for the downgrade window steps down one profile. */
  fps: Object.freeze({ HIGH: 60, STANDARD: 45, LOW: 30, FALLBACK_2D: 30 } satisfies Record<CapabilityProfile, number>),
  /** Lab first interactive on TARGET_LOW_DEVICE at LOW: cold on TARGET_NETWORK (Russell's 5 s bound), and warm/offline. */
  interactiveMs: Object.freeze({ cold: 5000, warmOffline: 3000 }),
  /** Whole-tab memory ceiling on a 3 GB Android Go device, and the JS heap share of it. */
  memoryCeilingMB: 200,
  jsHeapCeilingMB: 64,
});

type StaticBudget = { offlinePackageBytes: number; triangles: number; drawCalls: number; maxTexturePx: number; particles: number };

/**
 * Static budgets, enforced in CI. Package sizes: at Liberia's ~US$2.63/GB (cable.co.uk 2023) HIGH costs a learner
 * about 1.3 US cents; LOW fits well inside Russell's 3.7 MiB five-second page budget; FALLBACK_2D is text-scale.
 * STANDARD shares the HIGH package. Geometry budgets keep LOW within what a Mali-G57 MP1 draws at 30 fps.
 */
export const STATIC_BUDGETS: Readonly<Record<CapabilityProfile, StaticBudget>> = Object.freeze({
  HIGH: { offlinePackageBytes: 5 * 1024 * 1024, triangles: 100_000, drawCalls: 120, maxTexturePx: 2048, particles: 200 },
  STANDARD: { offlinePackageBytes: 5 * 1024 * 1024, triangles: 60_000, drawCalls: 90, maxTexturePx: 1024, particles: 120 },
  LOW: { offlinePackageBytes: 1.5 * 1024 * 1024, triangles: 15_000, drawCalls: 40, maxTexturePx: 512, particles: 48 },
  FALLBACK_2D: { offlinePackageBytes: 300 * 1024, triangles: 0, drawCalls: 0, maxTexturePx: 0, particles: 72 },
});

/** How far a measured value may grow over the committed baseline before CI calls it a regression. */
export const BUDGET_REGRESSION_TOLERANCE = 0.05;

/** Triangles per procedural mesh; kept in step with components/interactive-labs/v2/meshes.ts by test. */
export function geometryTriangles(kind: GeometryKind, low: boolean): number {
  switch (kind) {
    case "sphere": return low ? 12 * 8 * 2 : 24 * 16 * 2;
    case "cylinder": return (low ? 14 : 32) * 4;
    case "cone": return (low ? 14 : 32) * 2;
    default: return 12;
  }
}

/** A binary asset declared by the lab-asset-director. Procedural geometry has no entry here. */
export type LabAssetBytes = { id: string; bytes: number; profiles: CapabilityProfile[]; maxTexturePx?: number };

export type LabBudgetMeasurement = Record<CapabilityProfile, { offlinePackageBytes: number; triangles: number; drawCalls: number; maxTexturePx: number; particles: number }>;

/** Worst case across the given learner states (normally every review scenario) for every profile. */
export function measureLabBudget(definition: InteractiveLabDefinition<LabState>, states: LabState[], assets: LabAssetBytes[] = []): LabBudgetMeasurement {
  const definitionBytes = buildOfflineManifest(definition).bytes;
  const result = {} as LabBudgetMeasurement;
  for (const profile of Object.keys(RENDER_BUDGETS) as CapabilityProfile[]) {
    const profileAssets = assets.filter((asset) => asset.profiles.includes(profile));
    let triangles = 0, drawCalls = 0, particles = 0;
    for (const state of states) {
      const list = buildRenderList({ definition, state, profile });
      const svg = profile === "FALLBACK_2D", low = list.budget.meshDetail === "low";
      triangles = Math.max(triangles, svg ? 0 : list.items.reduce((sum, item) => sum + geometryTriangles(item.geometry, low), 0));
      // WebGLScene: one draw per item, three shared flow batches, and one optional marker batch.
      drawCalls = Math.max(drawCalls, svg ? 0 : list.items.length + (list.flows.length ? 3 : 0) + (list.markers.length ? 1 : 0));
      particles = Math.max(particles, list.flows.reduce((sum, flow) => sum + flow.particleCount, 0));
    }
    result[profile] = {
      offlinePackageBytes: definitionBytes + profileAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      triangles, drawCalls, particles,
      maxTexturePx: profileAssets.reduce((max, asset) => Math.max(max, asset.maxTexturePx ?? 0), 0),
    };
  }
  return result;
}

/** Budget violations and regressions against a committed baseline. Empty means the lab passes. */
export function checkLabBudget(labId: string, measured: LabBudgetMeasurement, baseline?: LabBudgetMeasurement): string[] {
  const problems: string[] = [];
  for (const profile of Object.keys(STATIC_BUDGETS) as CapabilityProfile[]) {
    for (const key of Object.keys(STATIC_BUDGETS[profile]) as (keyof StaticBudget)[]) {
      const value = measured[profile][key], limit = STATIC_BUDGETS[profile][key];
      if (value > limit) problems.push(`${labId} ${profile} ${key} ${value} exceeds budget ${limit}.`);
      const before = baseline?.[profile]?.[key];
      if (before !== undefined && value > Math.ceil(before * (1 + BUDGET_REGRESSION_TOLERANCE))) problems.push(`${labId} ${profile} ${key} regressed from ${before} to ${value} (> ${BUDGET_REGRESSION_TOLERANCE * 100}%). Update the baseline only with a reviewed reason.`);
    }
  }
  return problems;
}

/** Frame-time budget for the auto-downgrade: sustained frames slower than the profile's fps target (15% jitter allowance). */
export function downgradeFrameBudgetMs(profile: CapabilityProfile): number {
  return Math.round((1000 / RUNTIME_TARGETS.fps[profile]) * 1.15 * 10) / 10;
}
