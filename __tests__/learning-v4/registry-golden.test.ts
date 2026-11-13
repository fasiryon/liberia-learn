// Golden validation (CoS 1.3.0 ruling, required before freezing): the six sealed draft.6 packages and the three reviewed
// Grade 4 packages (math.2, science.2, english.2) validate exactly as they do today when routed through the new
// version dispatcher. Each package is pinned by its packageHash, and its learner projection by the manifest's own hash.
// The Grade 4 packages were sealed in T2's commit c6c060130 and are now in this tree byte-identically. They are read
// from the working tree, not from git history (a shallow CI checkout has no c6c060130); their integrity is pinned by
// packageHash and by the manifest's own file hashes below.
import crypto from "node:crypto";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBlock } from "@/lib/learner-experience/teaching/registry";
import { KNOWN_REGISTRY_VERSIONS, registryForVersion, validatePackageBlocks } from "@/lib/learner-experience/teaching/registries";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";

const PACKAGES = [
  { version: "4.0.0-draft.6", key: "g7-civics-counties-capitals", packageHash: "2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb" },
  { version: "4.0.0-draft.6", key: "g7-english-reading-evidence", packageHash: "fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19" },
  { version: "4.0.0-draft.6", key: "g7-math-area-perimeter", packageHash: "86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254" },
  { version: "4.0.0-draft.6", key: "g7-math-fractions", packageHash: "ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a" },
  { version: "4.0.0-draft.6", key: "g7-science-states-of-matter", packageHash: "7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9" },
  { version: "4.0.0-draft.6", key: "math-multiplication-models", packageHash: "7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce" },
  { version: "4.0.0-schoolday-primary-math.2-draft.1", key: "g4-math-three-digit-products", packageHash: "df24c30a680e745006ef124f671a26cccb1bdf64a8ec9f79b3273e8ba4d98eb2"},
  { version: "4.0.0-schoolday-primary-science.2-draft.1", key: "g4-science-food-path-and-absorption", packageHash: "6c9bb35aa616f76c316159159dcc2b96c22618e1a628f6e14a66b294ab2c607a"},
  { version: "4.0.0-schoolday-primary-english.2-draft.1", key: "g4-english-predict-question-summarize", packageHash: "39c9cafb634914512bd4cf396cdb454b2770a9057e5bd93734a6787e8757f0e6"},
] as const;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
function read(p: (typeof PACKAGES)[number], file: string): string {
  const path = `curriculum/factory-v4/drafts/${p.version}/${p.key}/${file}`;
  // A missing package is a failure (readFileSync throws), not a skip: golden evidence must be complete.
  return fs.readFileSync(path, "utf8");
}
type Block = { type: string };
function load(p: (typeof PACKAGES)[number]) {
  const manifest = JSON.parse(read(p, "manifest.json")), projectionBytes = read(p, "learner-projection.json"), sidecar = JSON.parse(read(p, "visual-teaching.json"));
  const experience = JSON.parse(projectionBytes);
  const blocks: Block[] = experience.scenes.flatMap((s: { teaching?: { blocks: Block[]; visual?: Block } }) => (s.teaching ? [...s.teaching.blocks, ...(s.teaching.visual ? [s.teaching.visual] : [])] : []));
  return { manifest, projectionBytes, sidecar, experience, blocks };
}

describe.each(PACKAGES)("golden: $version/$key", (p) => {
  const pkg = load(p);
  it("is the sealed package (packageHash, and the projection bytes match the manifest)", () => {
    expect(pkg.manifest.packageHash).toBe(p.packageHash);
    expect(sha(pkg.projectionBytes)).toBe(pkg.manifest.files["learner-projection.json"]);
  });
  it("declares a known registry (all nine are 1.1.0)", () => {
    expect(pkg.sidecar.registryVersion).toBe("teaching-blocks/1.1.0");
    expect(KNOWN_REGISTRY_VERSIONS).toContain(pkg.sidecar.registryVersion);
    expect(pkg.blocks.length).toBeGreaterThan(0);
  });
  it("validates identically through the dispatcher and the frozen 1.1.0 validator: no problems, as today", () => {
    const legacy = pkg.blocks.flatMap((b) => validateBlock(b).problems);
    const legacyWithContext = pkg.blocks.flatMap((b) => validateBlock(b, { subject: pkg.experience.subject, grade: pkg.experience.grade }).problems);
    expect(validatePackageBlocks(pkg.sidecar.registryVersion, pkg.blocks)).toEqual(legacy);
    expect(validatePackageBlocks(pkg.sidecar.registryVersion, pkg.blocks, { subject: pkg.experience.subject, grade: pkg.experience.grade })).toEqual(legacyWithContext);
    expect(legacy).toEqual([]);
  });
  it("still passes the scene contract unchanged", () => {
    expect(() => validateLessonExperience(pkg.experience)).not.toThrow();
  });
});

describe("dispatcher", () => {
  it("fails closed on an undeclared or unknown registry version", () => {
    expect(validatePackageBlocks(undefined, [])).toEqual(["teaching_block_registry_unknown:missing"]);
    expect(validatePackageBlocks("teaching-blocks/9.9.9", [])).toEqual(["teaching_block_registry_unknown:teaching-blocks/9.9.9"]);
    expect(() => registryForVersion("teaching-blocks/1.4.0")).toThrow("teaching_block_registry_unknown");
  });
  it("a 1.1.0 package cannot carry 1.2.0 STEM blocks", () => {
    const table = { type: "MEASUREMENT_TABLE", id: "t", title: "T", origin: "MEASURED_BY_LEARNER", originNote: "n", columns: [{ id: "a", label: "A", unit: "", precision: 0, minimum: 0, maximum: 9 }], trials: [{ a: null }], derived: [] };
    expect(validatePackageBlocks("teaching-blocks/1.1.0", [table])[0]).toMatch(/^block_type_unsupported:MEASUREMENT_TABLE/);
    expect(validatePackageBlocks("teaching-blocks/1.2.0", [table])).toEqual([]);
  });
});
