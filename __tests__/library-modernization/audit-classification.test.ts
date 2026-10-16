// Library Modernization V1: the legacy audit is mechanical, exact-revision, deterministic and never
// rates expert judgment or learning; classification is provisional and priority is not alphabetical.
import { describe, expect, it } from "vitest";
import { auditLegacyLesson, buildLibraryAuditContext, AUDIT_AREAS } from "@/lib/curriculum/modernization/legacyAudit";
import { classifyLesson, planWaves } from "@/lib/curriculum/modernization/classify";
import { checkArithmetic, sectionRole, splitSections } from "@/lib/curriculum/modernization/text";
import { parseLegacyAlignmentClaims, resolveMoeCell } from "@/lib/curriculum/modernization/moeAuthority";
import { legacyRecord, SOUND_BODY } from "./fixtures";

const audit = (record = legacyRecord(), peers = [record]) => auditLegacyLesson(record, buildLibraryAuditContext(peers));
const codes = (result: ReturnType<typeof audit>) => result.findings.map((finding) => finding.code);

describe("arithmetic verification", () => {
  it("checks simple binary arithmetic and reports wrong results", () => {
    expect(checkArithmetic("So 12 + 7 = 19.")[0]).toMatchObject({ correct: true });
    expect(checkArithmetic("Then 3 × 4 = 13 apples")[0]).toMatchObject({ correct: false, computed: 12 });
    expect(checkArithmetic("Total 8360 + 133,600 = 142,960 J")[0]).toMatchObject({ correct: false, computed: 141960 });
  });
  it("leaves compound, commutative and algebraic statements alone", () => {
    expect(checkArithmetic("3 + 4 × 2 = 11")).toHaveLength(0);
    expect(checkArithmetic("the order does not matter: 4 x 5 = 5 x 4")).toHaveLength(0);
    expect(checkArithmetic("x + 2 = 5")).toHaveLength(0);
    expect(checkArithmetic("Dates 2023-10 = x")).toHaveLength(0);
  });
  it("does not flag deliberate learner errors in error analysis", () => {
    const result = audit();
    expect(SOUND_BODY).toContain("27 + 15 = 312");
    expect(codes(result)).not.toContain("ARITHMETIC_ERROR");
  });
  it("flags a real error in a worked example", () => {
    const result = audit(legacyRecord({ body: SOUND_BODY.replace("So 27 + 15 = 42.", "So 27 + 15 = 52.") }));
    const finding = result.findings.find((f) => f.code === "ARITHMETIC_ERROR")!;
    expect(finding.kind).toBe("MECHANICAL");
    expect(finding.where).toMatch(/Worked Example 1/);
    expect(finding.evidence).toMatch(/computed value is 42/);
  });
});

describe("exact-revision, deterministic audit", () => {
  it("binds every audit to the revision id and content hash it read", () => {
    const record = legacyRecord();
    const result = audit(record);
    expect(result.revisionId).toBe(record.revision!.id);
    expect(result.contentHash).toBe(record.revision!.contentHash);
    expect(result.areas.map((area) => area.area)).toEqual([...AUDIT_AREAS]);
    for (const finding of result.findings) {
      expect(finding.id.startsWith(`${record.contentId}#F`)).toBe(true);
      expect(finding.where.length).toBeGreaterThan(0);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.proposedCorrection.length).toBeGreaterThan(0);
    }
  });
  it("is deterministic and changes digest when the revision changes", () => {
    const a = audit();
    expect(audit().auditDigest).toBe(a.auditDigest);
    const edited = audit(legacyRecord({ body: `${SOUND_BODY}\nOne more line.` }));
    expect(edited.contentHash).not.toBe(a.contentHash);
    expect(edited.auditDigest).not.toBe(a.auditDigest);
  });
  it("refuses a lesson with no current revision", () => {
    expect(() => audit({ ...legacyRecord(), revision: null })).toThrow(/NO_CURRENT_REVISION/);
  });
});

describe("judgment is never automated", () => {
  it("leaves judgment areas awaiting independent review and never claims learning", () => {
    const result = audit();
    for (const area of ["SUBJECT_ACCURACY", "CONCEPTUAL_DEPTH", "LIBERIAN_CONTEXT_EVIDENCE"]) {
      expect(result.areas.find((a) => a.area === area)!.status).not.toBe("MET");
    }
    expect(result.judgmentStatus).toBe("AWAITING_INDEPENDENT_REVIEW");
    expect(result.isLearningEvidence).toBe(false);
  });
  it("does not treat published status as effectiveness: published lessons still lack retention and transfer", () => {
    const result = audit(legacyRecord({ status: "published" }));
    expect(codes(result)).toEqual(expect.arrayContaining(["NO_DELAYED_RETRIEVAL", "NO_TRANSFER_TASK", "NO_MISCONCEPTION_SPECIFIC_FEEDBACK"]));
    expect(result.mechanicalOutcome).not.toBe("PASS_MECHANICAL_CHECKS");
  });
  it("marks unsourced statistics as judgment indicators, not facts", () => {
    const body = SOUND_BODY.replace("## 4. Core Concept", "## 4. Core Concept\nAccording to a 2021 study, 63% of Liberian students prefer cassava.");
    const finding = audit(legacyRecord({ body })).findings.find((f) => f.code.startsWith("UNSOURCED_CLAIM"))!;
    expect(finding.kind).toBe("JUDGMENT_INDICATOR");
  });
});

describe("structural defects", () => {
  it("detects placeholder template shells and requires a rebuild", () => {
    const shell = ["Objective", "Teacher Explanation", "Worked Example", "Guided Practice", "Independent Practice", "Assessment", "Remediation", "Extension"]
      .map((heading, i) => `## ${heading}\n${["Students will explain fractions.", "The teacher introduces the core concept using direct modeling and key vocabulary.", "Model one complete example connected to fractions, naming each step clearly.", "Guide learners through one shared task with teacher prompts and quick oral checks.", "Learners complete individual work that shows whether they can apply fractions.", "Use a short exit task with one recall item and one application item.", "Re-teach the main step with simpler examples and sentence frames.", "Ask confident learners to solve a slightly more complex version."][i]}`).join("\n\n");
    const result = audit(legacyRecord({ body: shell }));
    expect(codes(result)).toContain("PLACEHOLDER_CONTENT");
    expect(result.mechanicalOutcome).toBe("REBUILD_REQUIRED");
    expect(classifyLesson(legacyRecord({ body: shell }), result).track).toBe("C_FULL_REPLACEMENT");
  });
  it("flags answer keys in learner-facing text", () => {
    const body = `${SOUND_BODY}\n## Answer Key\n1. 83\n2. Because 5 + 8 = 13 regroups.`;
    expect(codes(audit(legacyRecord({ body })))).toContain("ANSWER_KEY_IN_LEARNER_TEXT");
  });
  it("flags lost content such as [object Object]", () => {
    expect(codes(audit(legacyRecord({ body: SOUND_BODY.replace("Step 1:", "[object Object]\nStep 1:") })))).toContain("SERIALIZATION_ARTIFACT");
  });
  it("flags emergent-reader text load in grades 1-3", () => {
    const long = `${SOUND_BODY}\n## Reading\n${"Musu counts the cassava bundles at the market every morning. ".repeat(140)}`;
    expect(codes(audit(legacyRecord({ grade: 2, body: long })))).toContain("TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET");
  });
});

describe("authority: nothing invented", () => {
  it("never treats LiberiaLearn codes as MOE objectives", () => {
    const claims = parseLegacyAlignmentClaims({ method: "ai", standards: [{ code: "LR-CIV-G1_3-01", description: "Identify national symbols" }] });
    expect(claims[0]).toMatchObject({ kind: "LIBERIALEARN_INVENTED_CODE", resolvedObjectiveId: null, method: "ai" });
    const result = audit(legacyRecord({ moeAlignments: { method: "ai", standards: [{ code: "LR-MATH-G4_6-02", description: "x" }] } }));
    expect(codes(result)).toContain("UNVERIFIED_ALIGNMENT_CODES");
    expect(result.metrics.resolvedMoeIds).toBe(0);
  });
  it("resolves a true structured MOE objective id", () => {
    const claims = parseLegacyAlignmentClaims(["moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1"]);
    expect(claims[0].kind).toBe("STRUCTURED_MOE_ID");
  });
  it("holds subjects with no MOE source and names the decision needed", () => {
    expect(resolveMoeCell("COMPUTER_SCIENCE", 5).relation).toBe("NONE");
    const record = legacyRecord({ subject: "COMPUTER_SCIENCE", contentId: "fixture-cs" });
    const result = audit(record);
    expect(result.mechanicalOutcome).toBe("BLOCKED_SOURCE_OR_AUTHORITY");
    const classification = classifyLesson(record, result);
    expect(classification.track).toBe("D_GOVERNANCE_HOLD");
    expect(classification.trackAfterHold).not.toBeNull();
    expect(classification.holdReasons).toContain("NO_MOE_SOURCE_FOR_SUBJECT");
    expect(classification.priority.score).toBe(0);
  });
  it("treats Civics as a proxy of MOE Social Studies needing an owner decision, not a hold", () => {
    expect(resolveMoeCell("CIVICS", 7).relation).toBe("PROXY");
    const result = audit(legacyRecord({ subject: "CIVICS", grade: 7 }));
    const proxy = result.findings.find((f) => f.code === "PROXY_SUBJECT_DECISION_REQUIRED")!;
    expect(proxy.severity).toBe("MAJOR");
  });
  it("holds teacher-owned and demo content instead of rewriting it", () => {
    expect(audit(legacyRecord({ teacherCreated: true })).mechanicalOutcome).toBe("BLOCKED_SOURCE_OR_AUTHORITY");
    expect(codes(audit(legacyRecord({ contentId: "demo-content-math-g4_6" })))).toContain("DEMO_OR_TEST_FIXTURE_IN_CATALOG");
  });
});

describe("priority", () => {
  it("ranks by risk, exposure and importance, never alphabetically", () => {
    const quiet = legacyRecord({ contentId: "a-quiet-lesson" });
    const used = legacyRecord({ contentId: "z-used-lesson", dependencies: { studentProgress: 400, scheduledWork: 30, scheduledWorkSchools: 3, learningEvents: 900 } });
    const context = buildLibraryAuditContext([quiet, used]);
    const items = [quiet, used].map((record) => ({ contentId: record.contentId, grade: record.row.grade, subject: record.row.subject, classification: classifyLesson(record, auditLegacyLesson(record, context)) }));
    const waves = planWaves(items, 10);
    expect(waves[0].contentId).toBe("z-used-lesson");
  });
  it("weights foundational literacy and numeracy above enrichment subjects", () => {
    const math = legacyRecord({ contentId: "m", subject: "MATH", grade: 2 });
    const civics = legacyRecord({ contentId: "c", subject: "CIVICS", grade: 2 });
    const context = buildLibraryAuditContext([math, civics]);
    expect(classifyLesson(math, auditLegacyLesson(math, context)).priority.importance).toBeGreaterThan(classifyLesson(civics, auditLegacyLesson(civics, context)).priority.importance);
  });
});

describe("section roles", () => {
  it("recognises the generated template headings", () => {
    expect(sectionRole("## 3. Prior Knowledge Activation")).toBe("PRIOR_KNOWLEDGE");
    expect(sectionRole("Guided Practice Problem 2")).toBe("GUIDED_PRACTICE");
    expect(sectionRole("Assessment, Exit Ticket, and Lesson Summary")).toBe("ASSESSMENT");
    expect(sectionRole("Teacher Explanation")).toBe("CONCEPT");
    expect(sectionRole("Step-by-Step Solution")).toBe("WORKED_EXAMPLE");
    expect(splitSections(SOUND_BODY).filter((s) => s.level > 0)).toHaveLength(9);
  });
});
