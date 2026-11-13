import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "fs";
import { createHash } from "crypto";
import { DRAFT6_PROFILE, DRAFT6_ROOT, buildDraft6, generateDraft6, priorDraftHashes } from "@/lib/content-factory/v4/draft6/generate";
import { authorLesson } from "@/lib/content-factory/v4/draft6/lessonAuthor";
import { validateAcademicCandidate } from "@/lib/content-factory/v4/draft6/quality";
import { checkRationalAnswer } from "@/lib/content-factory/v4/draft6/rational";
import { objectiveCoverage, reviewGuidance } from "@/lib/content-factory/v4/draft6/review";
import { geographicMap, heatingDiagram } from "@/lib/content-factory/v4/draft6/assets";
import { hash, textHash, verifyReferenceInputs } from "@/lib/content-factory/v4/generation";
import { buildReferenceCandidate } from "@/lib/content-factory/v4/referenceBatch";
import { DRAFT5_PROFILE } from "@/lib/content-factory/v4/draft5/generate";
import { V4_LESSONS } from "@/lib/curriculum/v4/candidates";

describe("draft.6 exact rational formative contract", () => {
  const exact = { exact: { numerator: 5, denominator: 6 }, decimal: "EXACT_TERMINATING_ONLY" as const };
  it.each(["5/6", "10/12", "25/30", " 50 / 60 "])("accepts equivalent exact fraction %s", value => {
    expect(checkRationalAnswer(value, exact).result).toBe("EXACT");
  });
  it.each(["0.83", "0.833333", "0.833333...", "5/0", "NaN", "Infinity", "1e-2"])("does not accept an approximation or invalid expression %s as exact", value => {
    expect(checkRationalAnswer(value, exact).result).not.toBe("EXACT");
  });
  it("distinguishes exact terminating decimals from explicitly requested approximations", () => {
    expect(checkRationalAnswer("0.875", { exact: { numerator: 7, denominator: 8 }, decimal: "EXACT_TERMINATING_ONLY" }).result).toBe("EXACT");
    const rounded = { exact: { numerator: 5, denominator: 12 }, decimal: "ROUND_HALF_UP" as const, places: 2 };
    expect(checkRationalAnswer("0.42", rounded).result).toBe("ROUNDED");
    expect(checkRationalAnswer("0.41", rounded).result).toBe("INCORRECT");
    expect(checkRationalAnswer("10/24", rounded).result).toBe("EXACT");
    expect(checkRationalAnswer("0.13", { exact: { numerator: 1, denominator: 8 }, decimal: "ROUND_HALF_UP", places: 2 }).result).toBe("ROUNDED");
    expect(checkRationalAnswer("-0.13", { exact: { numerator: -1, denominator: 8 }, decimal: "ROUND_HALF_UP", places: 2 }).result).toBe("ROUNDED");
  });
});

describe("draft.6 academic regressions and completeness", () => {
  it.each(DRAFT6_PROFILE.lessons)("binds real objectives and every written response for $key", lesson => {
    const candidate = authorLesson(lesson);
    const coverage = objectiveCoverage(lesson, candidate);
    expect(coverage).toHaveLength(lesson.objectives.length);
    expect(coverage.every(o => o.taught.length && o.practised.length && !o.masteryClaim)).toBe(true);
    const responses = reviewGuidance(lesson, candidate);
    const free = candidate.scenes.flatMap(s => s.interaction.kind === "FREE_RESPONSE" ? s.interaction.prompts : []);
    for (const prompt of free) expect(responses.some(r => r.responseId === prompt.id && r.acceptableReasoning.length > 50)).toBe(true);
    expect(candidate.scenes.filter(s => s.type === "MASTERY_CHECK").every(s => s.teaching?.blocks.length === 0 && s.interaction.kind === "ASSESSMENT_HANDOFF")).toBe(true);
  });
  it("rejects a heating curve with a missing phase plateau and an unvalidated temperature animation", () => {
    const lesson = DRAFT6_PROFILE.lessons.find(l => l.subject === "SCIENCE")!;
    const candidate = structuredClone(authorLesson(lesson));
    const plot = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "DATA_PLOT");
    if (plot?.type !== "DATA_PLOT") throw Error("missing_plot");
    plot.series[2].y = 10;
    expect(() => validateAcademicCandidate(candidate, lesson)).toThrow("heating_curve_physics");
  });
  it("rejects incomplete state properties and missing freezing practice", () => {
    const lesson = DRAFT6_PROFILE.lessons.find(l => l.subject === "SCIENCE")!;
    const candidate = structuredClone(authorLesson(lesson));
    const passage = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "CHECK" && b.id === "particle-properties");
    if (passage?.type !== "CHECK") throw Error("missing_properties");
    passage.items.pop();
    expect(() => validateAcademicCandidate(candidate, lesson)).toThrow("states_properties_incomplete");
    const complete = authorLesson(lesson);
    const noFreezing = { ...complete, scenes: complete.scenes.map(scene => ({ ...scene,
      teaching: scene.teaching ? { ...scene.teaching, blocks: scene.teaching.blocks.filter(b => !("id" in b) || b.id !== "freezing-energy") } : undefined,
    })) };
    expect(() => validateAcademicCandidate(noFreezing, lesson)).toThrow("missing_task:freezing-energy");
  });
  it("rejects a copied guided triangle and a consequence forced as direct evidence", () => {
    const geometry = DRAFT6_PROFILE.lessons[0], candidate = structuredClone(authorLesson(geometry));
    const blocks = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []);
    const guided = blocks.find(b => b.type === "NUMERIC_RESPONSE" && b.id === "guided-triangle");
    const worked = blocks.find(b => b.type === "WORKED_SOLUTION" && b.id === "triangle-worked");
    if (guided?.type !== "NUMERIC_RESPONSE" || worked?.type !== "WORKED_SOLUTION") throw Error("missing_geometry");
    guided.shape = worked.shape;
    expect(() => validateAcademicCandidate(candidate, geometry)).toThrow("guided_copies_worked");
    const english = DRAFT6_PROFILE.lessons.find(l => l.subject === "ENGLISH")!, passage = structuredClone(authorLesson(english));
    const evidence = passage.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "SOURCE_EVIDENCE");
    if (evidence?.type !== "SOURCE_EVIDENCE") throw Error("missing_evidence");
    evidence.sentences.find(s => s.id === "consequence")!.supports = true;
    expect(() => validateAcademicCandidate(passage, english)).toThrow("direct_consequence_conflated");
  });
  it("rejects omitted cross-products and direct quotations absent from the passage", () => {
    const lesson = DRAFT6_PROFILE.lessons.find(l => l.key.includes("multiplication"))!, candidate = structuredClone(authorLesson(lesson));
    const area = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "AREA_MODEL");
    if (area?.type !== "AREA_MODEL") throw Error("missing_area");
    area.splitB = [13];
    expect(() => validateAcademicCandidate(candidate, lesson)).toThrow("four_partial_rectangles_required");
    const english = DRAFT6_PROFILE.lessons.find(l => l.subject === "ENGLISH")!, passage = structuredClone(authorLesson(english));
    const evidence = passage.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "SOURCE_EVIDENCE");
    if (evidence?.type !== "SOURCE_EVIDENCE") throw Error("missing_evidence");
    evidence.sentences[0].text = "An invented quotation that was never in the passage.";
    expect(() => validateAcademicCandidate(passage, english)).toThrow("quotation_not_in_passage");
  });
  it("retains the exact upstream geographic geometry and supplies labeled accessible original diagrams", () => {
    const raw = readFileSync("curriculum/factory-v4/draft6-sources/liberia-counties.geojson");
    expect(createHash("sha256").update(raw).digest("hex")).toBe("f6f4ed18e1e29532a77325f7af84a6dacc4489d94020f2fa2a8feb12a4da9b34");
    const maps = geographicMap();
    expect(maps["liberia-county-map.svg"].match(/<path d="M/g)).toHaveLength(16); // north arrow plus fifteen polygons
    expect(maps["liberia-county-map.svg"]).toContain("CC BY 3.0 IGO");
    expect(maps["liberia-county-outline-task.svg"]).not.toContain("1. Bomi");
    const heat = heatingDiagram();
    expect(heat).toContain("2256 kilojoules");
    expect(heat).toContain("No time axis");
    expect(heat).toContain("aria-labelledby");
  });
});

describe("immutable draft.6 packages, review packet and prior versions", () => {
  it.each(DRAFT6_PROFILE.lessons)("rebuilds every package byte for byte and checks file hashes for $key", async lesson => {
    const built = await buildDraft6(lesson);
    for (const [name, bytes] of Object.entries(built.files)) expect(readFileSync(`${DRAFT6_ROOT}/${lesson.key}/${name}`, "utf8")).toBe(bytes);
    for (const [name, digest] of Object.entries(built.manifest.files)) expect(textHash(built.files[name])).toBe(digest);
    expect(built.manifest.released).toBe(false);
    expect(built.manifest.learnerDeliverable).toBe(false);
  });
  it("verifies committed source pins and reruns without changing mtimes or previous drafts", async () => {
    verifyReferenceInputs(process.cwd(), DRAFT6_PROFILE.inputs);
    const before = priorDraftHashes();
    const file = `${DRAFT6_ROOT}/review/complete-academic-packet.json`, mtime = statSync(file).mtimeMs;
    const receipt = await generateDraft6();
    expect(statSync(file).mtimeMs).toBe(mtime);
    expect(priorDraftHashes()).toEqual(before);
    expect(receipt.previewEnabled).toBe(false);
    const packet = JSON.parse(readFileSync(file, "utf8"));
    expect(packet.lessons).toHaveLength(6);
    for (const entry of packet.lessons) expect(hash(entry.candidate)).toBe(entry.manifest.candidateSha256);
    const plan = JSON.parse(readFileSync(`${DRAFT6_ROOT}/review/controlled-preview-plan.json`, "utf8"));
    expect(plan.eligiblePackageHashes).toEqual([]);
    expect(plan.canonicalRecordWrites).toBe(false);
  });
  it("preserves all draft.4 and draft.5 outputs under the shared builder extension", async () => {
    for (const profile of [undefined, DRAFT5_PROFILE]) for (const lesson of profile?.lessons ?? V4_LESSONS) {
      const built = await buildReferenceCandidate(lesson, profile), version = profile?.version ?? "4.0.0-draft.4";
      for (const [name, bytes] of Object.entries(built.files))
        expect(readFileSync(`curriculum/factory-v4/drafts/${version}/${lesson.key}/${name}`, "utf8").replaceAll("\r\n", "\n")).toBe(bytes);
    }
  });
});
