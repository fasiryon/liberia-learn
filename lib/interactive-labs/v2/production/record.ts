// Machine-checkable production record for a lab (Production Team V1.1: tiers, benchmark scoring, asset
// provenance, runtime extensions, SHIP_CANDIDATE vs SHIP_VERIFIED). One record per lab lives at
// docs/labs/<labId>/production.json and is validated in CI. A production status is an experience-quality and
// evidence claim by the team. It never changes reviewState/approvalState, release binding or evidence authority.
import type { CapabilityProfile } from "../types";

export const LAB_PRODUCTION_RECORD_VERSION = "lab-production-record/1.0.0" as const;

export type LabTier = "HERO" | "STANDARD" | "DERIVATIVE";
export type LabProductionStatus = "DRAFT" | "SHIP_CANDIDATE" | "SHIP_VERIFIED";
export type ReviewerAgent =
  | "lab-pedagogy-director" | "lab-experience-director" | "lab-simulation-architect" | "lab-asset-director"
  | "lab-visual-reviewer" | "lab-interaction-reviewer" | "lab-science-reviewer" | "lab-performance-reviewer" | "lab-design-director";
export type Severity = "P0" | "P1" | "P2";
export type BenchmarkScore = "BEATS" | "MATCHES" | "BELOW";
export type TradeoffContext = "LOW" | "OFFLINE" | "ACCESSIBILITY";
export type Precedence = "curriculum" | "science" | "comprehension" | "accessibility" | "experience";

export type ReviewFinding = { id: string; severity: Severity; lens: string; summary: string; status: "OPEN" | "FIXED" | "WONT_FIX" | "BLOCKED"; resolution?: string; commit?: string; verifiedOn?: string };
export type ReviewRound = { round: number; label: string; date: string; captures: string; checkpoint: string; reviewers: ReviewerAgent[]; renderer: string; findings: ReviewFinding[] };
export type BenchmarkReference = { id: string; title: string; source: "prior-lab" | "approved-inspiration"; capture: string; approval: string };
export type BenchmarkQuality = { name: string; description: string; referenceIds: string[]; score?: BenchmarkScore; evidence?: string; tradeoff?: { context: TradeoffContext; reason: string } };
export type AssetRecord = { id: string; componentIds: string[]; kind: "procedural" | "gltf" | "generated"; license: string; provenance: string; bytes?: number; profiles?: CapabilityProfile[]; maxTexturePx?: number; generator?: string; generatorTerms?: string; humanReviewer?: string };
export type Disagreement = { id: string; between: ReviewerAgent[]; topic: string; resolution: string; precedence: Precedence; why: string };
export type RuntimeExtension = { id: string; capability: string; proposal: string; status: "PROPOSED" | "APPROVED" | "IMPLEMENTED" | "REJECTED"; reviewers: ReviewerAgent[]; tests?: string };
export type PilotEvidence = { schools: string[]; devices: string[]; students: number; dates: string; completionRate: number; medianTimeOnTaskMin: number; prePostChange: string; failurePoints: string[]; teacherNotes: string[]; xapiExport: string; consent: string; findings: ReviewFinding[] };

export type LabProductionRecord = {
  recordVersion: typeof LAB_PRODUCTION_RECORD_VERSION;
  labId: string;
  labVersion: string;
  tier: LabTier;
  tierReason: string;
  status: LabProductionStatus;
  authority: { governedObjective: boolean; objectiveIds: string[]; note: string };
  design: { pedagogyBrief: string; storyboard: string; simulationSpec: string; assetSpec: string };
  benchmark?: { references: BenchmarkReference[]; qualities: BenchmarkQuality[] };
  assets: AssetRecord[];
  rounds: ReviewRound[];
  disagreements: Disagreement[];
  runtimeExtensions: RuntimeExtension[];
  tradeoffs: { what: string; why: string }[];
  designVerdict?: { verdict: "SHIP" | "DO_NOT_SHIP"; round: number; date: string };
  pilot?: PilotEvidence;
};

/** Reviewers each tier must have run, and whether the tier needs benchmark scoring and a final design verdict. */
export const TIER_REQUIREMENTS: Readonly<Record<LabTier, { rounds: ReviewerAgent[][]; benchmark: boolean; designVerdict: boolean }>> = Object.freeze({
  HERO: {
    rounds: [
      ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-science-reviewer"],
      ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-pedagogy-director"],
      ["lab-design-director", "lab-performance-reviewer", "lab-science-reviewer"],
    ],
    benchmark: true,
    designVerdict: true,
  },
  STANDARD: {
    rounds: [["lab-visual-reviewer", "lab-interaction-reviewer", "lab-science-reviewer"], ["lab-design-director", "lab-science-reviewer"]],
    benchmark: false,
    designVerdict: true,
  },
  DERIVATIVE: { rounds: [["lab-science-reviewer", "lab-interaction-reviewer", "lab-performance-reviewer"]], benchmark: false, designVerdict: false },
});

/** Licenses an authored or generated asset may carry. Anything else is treated as unlicensed. */
export const ALLOWED_ASSET_LICENSES = Object.freeze(["LiberiaLearn-original", "CC0-1.0", "CC-BY-4.0"]);

/** The benchmark ship rule: every quality scored, no BELOW without a recorded LOW/offline/accessibility trade-off, at least one BEATS. */
export function benchmarkProblems(benchmark: LabProductionRecord["benchmark"]): string[] {
  if (!benchmark) return ["No reference benchmark."];
  const problems: string[] = [];
  if (benchmark.references.length < 3 || benchmark.references.length > 6) problems.push(`Benchmark needs 3–6 reference captures, has ${benchmark.references.length}.`);
  for (const reference of benchmark.references) if (!reference.capture || !reference.approval) problems.push(`Reference ${reference.id} needs a capture and an approval/provenance note.`);
  const referenceIds = new Set(benchmark.references.map((reference) => reference.id));
  if (benchmark.qualities.length === 0) problems.push("Benchmark names no qualities.");
  for (const quality of benchmark.qualities) {
    if (!quality.score) problems.push(`Quality "${quality.name}" is not scored.`);
    if (quality.score && !quality.evidence) problems.push(`Quality "${quality.name}" has a score but no side-by-side evidence.`);
    if (quality.referenceIds.some((id) => !referenceIds.has(id))) problems.push(`Quality "${quality.name}" cites an unknown reference.`);
    if (quality.score === "BELOW" && !(quality.tradeoff?.reason && ["LOW", "OFFLINE", "ACCESSIBILITY"].includes(quality.tradeoff.context))) problems.push(`Quality "${quality.name}" is BELOW the reference without a recorded LOW/offline/accessibility trade-off.`);
  }
  if (!benchmark.qualities.some((quality) => quality.score === "BEATS")) problems.push("No quality BEATS the reference.");
  return problems;
}

function assetProblems(assets: AssetRecord[]): string[] {
  const problems: string[] = [];
  for (const asset of assets) {
    if (!asset.provenance) problems.push(`Asset ${asset.id} has no provenance.`);
    if (asset.kind !== "procedural" && !ALLOWED_ASSET_LICENSES.includes(asset.license)) problems.push(`Asset ${asset.id} license "${asset.license}" is not allowed.`);
    if (asset.kind !== "procedural" && (asset.bytes === undefined || !asset.profiles?.length)) problems.push(`Asset ${asset.id} must declare bytes and profiles for the budget check.`);
    if (asset.kind === "generated" && !(asset.generator && asset.generatorTerms && asset.humanReviewer)) problems.push(`Generated asset ${asset.id} needs generator, generator terms and a human reviewer.`);
  }
  return problems;
}

/** Everything the record's claimed status requires but does not prove. Empty means the status is justified. */
export function validateProductionRecord(record: LabProductionRecord, definitionVersion?: string): string[] {
  const problems: string[] = [];
  if (record.recordVersion !== LAB_PRODUCTION_RECORD_VERSION) problems.push("Unknown record version.");
  if (definitionVersion && record.labVersion !== definitionVersion) problems.push(`Record is for ${record.labId}@${record.labVersion}, definition is ${definitionVersion}.`);
  if (!record.tierReason) problems.push("Tier must be assigned with a reason at the pedagogy stage.");
  problems.push(...assetProblems(record.assets));
  for (const disagreement of record.disagreements) if (!disagreement.resolution || !disagreement.why || disagreement.between.length < 2) problems.push(`Disagreement ${disagreement.id} needs both parties, a resolution and why.`);
  if (record.status === "DRAFT") return problems;

  const requirement = TIER_REQUIREMENTS[record.tier];
  requirement.rounds.forEach((reviewers, index) => {
    const round = record.rounds.find((candidate) => candidate.round === index + 1);
    if (!round) { problems.push(`${record.tier} lab is missing review round ${index + 1}.`); return; }
    const missing = reviewers.filter((reviewer) => !round.reviewers.includes(reviewer));
    if (missing.length) problems.push(`Round ${index + 1} is missing ${missing.join(", ")}.`);
    if (!round.captures || !round.checkpoint || !round.renderer) problems.push(`Round ${index + 1} needs captures, a checkpoint commit and the renderer used.`);
  });
  for (const round of record.rounds) for (const finding of round.findings) {
    if (finding.severity === "P0" && finding.status !== "FIXED") problems.push(`P0 ${finding.id} is ${finding.status}; SHIP needs zero open P0.`);
    if (finding.severity === "P0" && finding.status === "FIXED" && !finding.verifiedOn) problems.push(`P0 ${finding.id} is fixed but not verified on new captures.`);
  }
  if (requirement.benchmark) problems.push(...benchmarkProblems(record.benchmark));
  if (requirement.designVerdict && record.designVerdict?.verdict !== "SHIP") problems.push("The design director has not returned SHIP.");
  for (const extension of record.runtimeExtensions) if (extension.status !== "IMPLEMENTED" && extension.status !== "REJECTED") problems.push(`Runtime extension ${extension.id} is ${extension.status}.`);
  for (const extension of record.runtimeExtensions) if (extension.status === "IMPLEMENTED" && !(extension.reviewers.includes("lab-performance-reviewer") && extension.reviewers.includes("lab-design-director") && extension.tests)) problems.push(`Runtime extension ${extension.id} needs performance + design review and tests.`);
  if (record.status === "SHIP_CANDIDATE") return problems;

  const pilot = record.pilot;
  if (!pilot) return [...problems, "SHIP_VERIFIED needs pilot evidence from real students on real school devices."];
  if (pilot.students < 1 || pilot.schools.length < 1 || pilot.devices.length < 1) problems.push("Pilot must name schools, real devices and a student count.");
  if (!pilot.consent) problems.push("Pilot must reference the consent/authorization it ran under.");
  if (!pilot.xapiExport) problems.push("Pilot must reference its xAPI evidence export.");
  if (!pilot.prePostChange || pilot.failurePoints.length === 0 || pilot.teacherNotes.length === 0) problems.push("Pilot must record pre/post change, failure points and teacher notes.");
  if (!Number.isFinite(pilot.completionRate) || pilot.completionRate < 0 || pilot.completionRate > 1) problems.push("Pilot completionRate must be a fraction from 0 to 1.");
  if (!Number.isFinite(pilot.medianTimeOnTaskMin) || pilot.medianTimeOnTaskMin < 0) problems.push("Pilot medianTimeOnTaskMin must be a finite, non-negative number of minutes.");
  for (const finding of pilot.findings) if (finding.severity === "P0" && finding.status !== "FIXED") problems.push(`Pilot P0 ${finding.id} is ${finding.status}.`);
  return problems;
}
