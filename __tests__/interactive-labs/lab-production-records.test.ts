import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { benchmarkProblems, LAB_PRODUCTION_RECORD_VERSION, validateProductionRecord, type LabProductionRecord } from "@/lib/interactive-labs/v2/production/record";

const labsDir = path.join(process.cwd(), "docs/labs");
const records = existsSync(labsDir)
  ? readdirSync(labsDir).filter((dir) => existsSync(path.join(labsDir, dir, "production.json"))).map((dir) => JSON.parse(readFileSync(path.join(labsDir, dir, "production.json"), "utf8")) as LabProductionRecord)
  : [];

const round = (n: number, reviewers: LabProductionRecord["rounds"][number]["reviewers"], findings: LabProductionRecord["rounds"][number]["findings"] = []) => ({ round: n, label: `round-${n}`, date: "2026-09-28", captures: `artifacts/lab-review/x/1.0.0/round-${n}`, checkpoint: "abc1234", reviewers, renderer: "software", findings });
const shipped: LabProductionRecord = {
  recordVersion: LAB_PRODUCTION_RECORD_VERSION, labId: "x", labVersion: "1.0.0", tier: "HERO", tierReason: "flagship", status: "SHIP_CANDIDATE",
  authority: { governedObjective: false, objectiveIds: [], note: "fixture" },
  design: { pedagogyBrief: "a", storyboard: "b", simulationSpec: "c", assetSpec: "d" },
  benchmark: {
    references: ["r1", "r2", "r3"].map((id) => ({ id, title: id, source: "prior-lab" as const, capture: `${id}.png`, approval: "own lab" })),
    qualities: [
      { name: "cutaway clarity", description: "", referenceIds: ["r1"], score: "MATCHES", evidence: "r1.png vs a.png" },
      { name: "local relevance", description: "", referenceIds: ["r2"], score: "BEATS", evidence: "r2.png vs b.png" },
    ],
  },
  assets: [{ id: "all", componentIds: ["*"], kind: "procedural", license: "LiberiaLearn-original", provenance: "runtime meshes" }],
  rounds: [
    round(1, ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-science-reviewer"], [{ id: "R1-S-01", severity: "P0", lens: "SCIENCE", summary: "s", status: "FIXED", commit: "c", verifiedOn: "round-1-fix" }]),
    round(2, ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-pedagogy-director"]),
    round(3, ["lab-design-director", "lab-performance-reviewer", "lab-science-reviewer"]),
  ],
  disagreements: [{ id: "D1", between: ["lab-visual-reviewer", "lab-science-reviewer"], topic: "t", resolution: "science", precedence: "science", why: "w" }],
  runtimeExtensions: [{ id: "E1", capability: "spin", proposal: "docs/x.md", status: "IMPLEMENTED", reviewers: ["lab-performance-reviewer", "lab-design-director"], tests: "t.test.ts" }],
  tradeoffs: [],
  designVerdict: { verdict: "SHIP", round: 3, date: "2026-09-28" },
};

describe("lab production records", () => {
  it("every committed production record justifies its claimed status", () => {
    for (const record of records) {
      const definition = getInteractiveLabDefinition(record.labId);
      expect(definition, record.labId).not.toBeNull();
      expect(validateProductionRecord(record, definition!.version), record.labId).toEqual([]);
      // A production status never stands in for governance: it cannot coexist with a claim of learner approval it did not earn.
      if (record.status !== "DRAFT") expect(record.authority.note.length, record.labId).toBeGreaterThan(0);
    }
  });

  it("a complete hero record is a valid SHIP_CANDIDATE", () => {
    expect(validateProductionRecord(shipped)).toEqual([]);
  });

  it("SHIP needs more than 'nothing is broken': benchmark rule", () => {
    const noBeats = structuredClone(shipped); noBeats.benchmark!.qualities[1].score = "MATCHES";
    expect(benchmarkProblems(noBeats.benchmark).join(" ")).toContain("No quality BEATS");
    const below = structuredClone(shipped); below.benchmark!.qualities[0].score = "BELOW";
    expect(validateProductionRecord(below).join(" ")).toContain("BELOW the reference without a recorded");
    below.benchmark!.qualities[0].tradeoff = { context: "LOW", reason: "LOW hides the clip plane" };
    expect(validateProductionRecord(below)).toEqual([]);
    const tooFew = structuredClone(shipped); tooFew.benchmark!.references = tooFew.benchmark!.references.slice(0, 2);
    expect(validateProductionRecord(tooFew).join(" ")).toContain("3–6 reference captures");
  });

  it("open or unverified P0s, missing rounds and missing verdicts block SHIP_CANDIDATE", () => {
    const open = structuredClone(shipped); open.rounds[0].findings[0].status = "OPEN";
    expect(validateProductionRecord(open).join(" ")).toContain("P0 R1-S-01 is OPEN");
    const unverified = structuredClone(shipped); delete unverified.rounds[0].findings[0].verifiedOn;
    expect(validateProductionRecord(unverified).join(" ")).toContain("not verified");
    const missing = structuredClone(shipped); missing.rounds = missing.rounds.slice(0, 2);
    expect(validateProductionRecord(missing).join(" ")).toContain("missing review round 3");
    const noVerdict = structuredClone(shipped); noVerdict.designVerdict = { verdict: "DO_NOT_SHIP", round: 3, date: "d" };
    expect(validateProductionRecord(noVerdict).join(" ")).toContain("has not returned SHIP");
    const pending = structuredClone(shipped); pending.runtimeExtensions[0].status = "PROPOSED";
    expect(validateProductionRecord(pending).join(" ")).toContain("Runtime extension E1 is PROPOSED");
  });

  it("tiers set the review loop", () => {
    const derivative: LabProductionRecord = { ...structuredClone(shipped), tier: "DERIVATIVE", benchmark: undefined, designVerdict: undefined, rounds: [round(1, ["lab-science-reviewer", "lab-interaction-reviewer", "lab-performance-reviewer"])] };
    expect(validateProductionRecord(derivative)).toEqual([]);
    const standard: LabProductionRecord = { ...structuredClone(shipped), tier: "STANDARD", benchmark: undefined, rounds: [round(1, ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-science-reviewer"]), round(2, ["lab-design-director"])] };
    expect(validateProductionRecord(standard).join(" ")).toContain("Round 2 is missing lab-science-reviewer");
  });

  it("assets need licence and provenance; generated assets need a human check", () => {
    const record = structuredClone(shipped);
    record.assets.push({ id: "turbine", componentIds: ["turbine"], kind: "gltf", license: "unknown", provenance: "downloaded", bytes: 10, profiles: ["HIGH"] });
    record.assets.push({ id: "gen", componentIds: ["x"], kind: "generated", license: "CC0-1.0", provenance: "tool", bytes: 10, profiles: ["HIGH"] });
    const problems = validateProductionRecord(record).join(" ");
    expect(problems).toContain('license "unknown" is not allowed');
    expect(problems).toContain("needs generator, generator terms and a human reviewer");
  });

  it("SHIP_VERIFIED needs real pilot evidence; AI review alone cannot reach it", () => {
    const claim = { ...structuredClone(shipped), status: "SHIP_VERIFIED" as const };
    expect(validateProductionRecord(claim).join(" ")).toContain("needs pilot evidence");
    claim.pilot = { schools: ["S"], devices: ["Tecno Spark Go 2024"], students: 24, dates: "2026-10", completionRate: 0.8, medianTimeOnTaskMin: 14, prePostChange: "+22 pts", failurePoints: ["trace step 3"], teacherNotes: ["n"], xapiExport: "export-id", consent: "MOE pilot authorization ref", findings: [] };
    expect(validateProductionRecord(claim)).toEqual([]);
  });
});
