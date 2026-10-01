import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildMesh } from "@/components/interactive-labs/v2/meshes";
import { RENDER_BUDGETS, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { buildOfflineManifest } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { measureRegisteredLab } from "@/lib/interactive-labs/v2/production/measure";
import { checkLabBudget, downgradeFrameBudgetMs, geometryTriangles, LAB_BUDGET_LOCKED_ON, RUNTIME_TARGETS, STATIC_BUDGETS, TARGET_LOW_DEVICE, type LabBudgetMeasurement } from "@/lib/interactive-labs/v2/production/budgets";
import type { LabProductionRecord } from "@/lib/interactive-labs/v2/production/record";
import type { GeometryKind } from "@/lib/interactive-labs/v2/types";

const baseline = JSON.parse(readFileSync(path.join(process.cwd(), "lib/interactive-labs/v2/production/budget-baseline.json"), "utf8")) as Record<string, LabBudgetMeasurement>;
const MB = 1024 * 1024;

function assetsFor(labId: string) {
  const file = path.join(process.cwd(), "docs/labs", labId, "production.json");
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, "utf8")) as LabProductionRecord).assets.filter((asset) => asset.kind !== "procedural").map((asset) => ({ id: asset.id, bytes: asset.bytes ?? 0, profiles: asset.profiles ?? [], maxTexturePx: asset.maxTexturePx }));
}

describe("lab budgets (locked 2026-09-28)", () => {
  it("budget values are locked; changing one must be a deliberate edit here", () => {
    expect(LAB_BUDGET_LOCKED_ON).toBe("2026-09-28");
    expect(TARGET_LOW_DEVICE.name).toBe("Tecno Spark Go 2024 (3 GB RAM variant)");
    expect(TARGET_LOW_DEVICE.expectedProfile).toBe("LOW");
    expect(RUNTIME_TARGETS).toEqual({ fps: { HIGH: 60, STANDARD: 45, LOW: 30, FALLBACK_2D: 30 }, interactiveMs: { cold: 5000, warmOffline: 3000 }, memoryCeilingMB: 200, jsHeapCeilingMB: 64 });
    expect(STATIC_BUDGETS).toEqual({
      HIGH: { offlinePackageBytes: 5 * MB, triangles: 100_000, drawCalls: 120, maxTexturePx: 2048, particles: 200 },
      STANDARD: { offlinePackageBytes: 5 * MB, triangles: 60_000, drawCalls: 90, maxTexturePx: 1024, particles: 120 },
      LOW: { offlinePackageBytes: 1.5 * MB, triangles: 15_000, drawCalls: 40, maxTexturePx: 512, particles: 48 },
      FALLBACK_2D: { offlinePackageBytes: 300 * 1024, triangles: 0, drawCalls: 0, maxTexturePx: 0, particles: 72 },
    });
  });

  it("triangle accounting matches the procedural meshes the renderer draws", () => {
    for (const kind of ["sphere", "cylinder", "cone", "cube", "rectangular-prism", "box", "panel", "lever"] as GeometryKind[]) {
      for (const low of [false, true]) expect(geometryTriangles(kind, low), `${kind} low=${low}`).toBe(buildMesh(kind, low).count / 3);
    }
  });

  it("every registered lab is within budget and has not regressed from its baseline", () => {
    for (const labId of Object.keys(LAB_REVIEW_SCENARIO_SETS)) {
      expect(baseline[labId], `${labId} needs a budget baseline (scripts/labs/update-lab-budget-baseline.ts)`).toBeDefined();
      expect(checkLabBudget(labId, measureRegisteredLab(labId, assetsFor(labId)), baseline[labId])).toEqual([]);
      const manifest = buildOfflineManifest(getInteractiveLabDefinition(labId)!);
      expect(manifest.remoteAssets, labId).toEqual([]);
    }
  });

  it("detects violations and regressions", () => {
    const measured = measureRegisteredLab("fixture-simple-circuit");
    const over = structuredClone(measured); over.LOW.drawCalls = STATIC_BUDGETS.LOW.drawCalls + 1;
    expect(checkLabBudget("x", over).join(" ")).toContain("LOW drawCalls");
    const grown = structuredClone(measured); grown.HIGH.triangles = Math.ceil(measured.HIGH.triangles * 1.2);
    expect(checkLabBudget("x", grown, measured).join(" ")).toContain("regressed");
  });

  it("auto-downgrade fires when fps stays below each profile's target, not on hitches", () => {
    const sustained = (fps: number) => Array.from({ length: 60 }, () => 1000 / fps);
    expect(shouldDowngrade(sustained(60), downgradeFrameBudgetMs("HIGH"))).toBe(false);
    expect(shouldDowngrade(sustained(45), downgradeFrameBudgetMs("HIGH"))).toBe(true);
    expect(shouldDowngrade(sustained(45), downgradeFrameBudgetMs("STANDARD"))).toBe(false);
    expect(shouldDowngrade(sustained(30), downgradeFrameBudgetMs("STANDARD"))).toBe(true);
    expect(shouldDowngrade(sustained(30), downgradeFrameBudgetMs("LOW"))).toBe(false);
    expect(shouldDowngrade(sustained(20), downgradeFrameBudgetMs("LOW"))).toBe(true);
    // WebGLScene clamps a frame to 100 ms, so one long hitch cannot trigger a downgrade on its own.
    expect(shouldDowngrade([...sustained(60).slice(0, 59), 100], downgradeFrameBudgetMs("HIGH"))).toBe(false);
  });

  it("limits pulsing highlights to HIGH and keeps reduced profiles steady", () => {
    expect(RENDER_BUDGETS.HIGH.pulseHighlights).toBe(true);
    expect(RENDER_BUDGETS.STANDARD.pulseHighlights).toBe(false);
    expect(RENDER_BUDGETS.LOW.pulseHighlights).toBe(false);
    expect(RENDER_BUDGETS.FALLBACK_2D.pulseHighlights).toBe(false);
  });
});
