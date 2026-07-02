import { describe, expect, it } from "vitest";
import {
  contentSubjectToWaec,
  deterministicTopics,
  masteryStrandCandidates,
  subjectStrandRefs,
  getWaecSubject,
  isKnownTopic,
} from "@/lib/waec/syllabus";
import { computeSubjectReadiness } from "@/lib/waec/readiness";
import { coerceMasterySubject, resolveMasteryStrandForLesson } from "@/lib/mastery/resolveStrand";

describe("WAEC syllabus map", () => {
  it("maps content subject strings to WAEC subjects", () => {
    expect(contentSubjectToWaec("PHYSICS")?.id).toBe("waec_physics");
    expect(contentSubjectToWaec("physics")?.id).toBe("waec_physics");
    expect(contentSubjectToWaec("LITERACY")?.id).toBe("waec_english");
    expect(contentSubjectToWaec("MATHEMATICS")?.id).toBe("waec_math");
    expect(contentSubjectToWaec("ARTS")).toBeUndefined();
  });

  it("Geography has no mastery bucket (documented gap)", () => {
    expect(getWaecSubject("waec_geography")?.masterySubject).toBeNull();
    expect(subjectStrandRefs("waec_geography")).toHaveLength(0);
  });

  it("distinguishes Physics/Chemistry/Biology despite one SCIENCE bucket", () => {
    const phys = subjectStrandRefs("waec_physics").map((r) => r.strandKey);
    const chem = subjectStrandRefs("waec_chemistry").map((r) => r.strandKey);
    const bio = subjectStrandRefs("waec_biology").map((r) => r.strandKey);
    expect(phys).toContain("physics_mechanics");
    expect(chem).toContain("organic_chemistry");
    expect(bio).toContain("advanced_biology");
    // Physics strands are not the same set as chemistry strands.
    expect(phys.some((s) => chem.includes(s) && s !== "scientific_method")).toBe(false);
  });

  it("deterministic tagging matches keywords in title", () => {
    const topics = deterministicTopics({ contentSubject: "BIOLOGY", title: "Photosynthesis and the Ecosystem food chain" });
    expect(topics).toContain("biology.ecology");
    topics.forEach((t) => expect(isKnownTopic(t)).toBe(true));
  });

  it("mastery strand candidates use persisted WAEC topics when present", () => {
    const cands = masteryStrandCandidates({
      contentSubject: "PHYSICS",
      waecTopics: ["physics.mechanics"],
    });
    expect(cands[0]).toEqual({ subject: "SCIENCE", strandKey: "physics_mechanics" });
  });

  it("returns no candidates for non-mastery WAEC subjects", () => {
    expect(masteryStrandCandidates({ contentSubject: "GEOGRAPHY", waecTopics: ["geography.physical"] })).toHaveLength(0);
  });
});

describe("computeSubjectReadiness", () => {
  it("returns null readiness when nothing is assessed", () => {
    const r = computeSubjectReadiness("waec_physics", {});
    expect(r.readiness).toBeNull();
    expect(r.coverage).toBe(0);
    expect(r.available).toBe(true);
    // next focus falls back to the highest-weight topic
    expect(r.nextFocusTopicId).toBeTruthy();
  });

  it("computes an exam-weighted score from assessed strands", () => {
    const r = computeSubjectReadiness("waec_physics", {
      physics_mechanics: { current: 0.8, baseline: 0.5 },
      physics_energy: { current: 0.6, baseline: 0.6 },
    });
    expect(r.readiness).not.toBeNull();
    expect(r.readiness!).toBeGreaterThan(0);
    expect(r.readiness!).toBeLessThanOrEqual(100);
    expect(r.coverage).toBeGreaterThan(0);
    expect(r.coverage).toBeLessThanOrEqual(1);
  });

  it("marks trend improving when current exceeds baseline", () => {
    const r = computeSubjectReadiness("waec_math", {
      advanced_algebra: { current: 0.9, baseline: 0.5 },
    });
    expect(r.trend).toBe("improving");
  });

  it("marks trend steady inside the deadband", () => {
    const r = computeSubjectReadiness("waec_math", {
      advanced_algebra: { current: 0.71, baseline: 0.7 },
    });
    expect(r.trend).toBe("steady");
  });

  it("picks the weakest covered topic as next focus", () => {
    const r = computeSubjectReadiness("waec_biology", {
      cells_biology: { current: 0.9, baseline: 0.9 }, // organisation/variety
      ecology_advanced: { current: 0.3, baseline: 0.3 }, // ecology — weakest
    });
    expect(r.nextFocusTopicId).toBe("biology.ecology");
  });

  it("Geography is unavailable (no fabricated score)", () => {
    const r = computeSubjectReadiness("waec_geography", {});
    expect(r.available).toBe(false);
    expect(r.readiness).toBeNull();
  });
});

describe("coerceMasterySubject", () => {
  it("routes WAEC science subfields to SCIENCE (not the LITERACY default)", () => {
    expect(coerceMasterySubject("PHYSICS")).toBe("SCIENCE");
    expect(coerceMasterySubject("CHEMISTRY")).toBe("SCIENCE");
    expect(coerceMasterySubject("BIOLOGY")).toBe("SCIENCE");
    expect(coerceMasterySubject("GEOGRAPHY")).toBe("CIVICS");
    expect(coerceMasterySubject("ENGLISH")).toBe("LITERACY");
    expect(coerceMasterySubject("MATHEMATICS")).toBe("MATH");
  });
});

describe("resolveMasteryStrandForLesson", () => {
  function fakeClient(opts: { existing?: Set<string>; fallback?: string | null }) {
    const existing = opts.existing ?? new Set<string>();
    return {
      strandCatalog: {
        findUnique: async ({ where }: any) => {
          const { subject, strandKey } = where.StrandCatalog_subject_strandKey_key;
          return existing.has(`${subject}:${strandKey}`) ? { subject } : null;
        },
        findFirst: async () => (opts.fallback ? { strandKey: opts.fallback } : null),
      },
    } as any;
  }

  it("resolves a WAEC strand for Grade 9+ tagged content", async () => {
    const client = fakeClient({ existing: new Set(["SCIENCE:physics_mechanics"]) });
    const res = await resolveMasteryStrandForLesson(
      { contentSubject: "PHYSICS", grade: 11, waecTopics: ["physics.mechanics"] },
      client
    );
    expect(res).toEqual({ subject: "SCIENCE", strandKey: "physics_mechanics", gradeBand: "G10_12" });
  });

  it("does NOT use advanced WAEC strands for lower grades", async () => {
    const client = fakeClient({ existing: new Set(["SCIENCE:physics_mechanics"]), fallback: "forces_motion" });
    const res = await resolveMasteryStrandForLesson(
      { contentSubject: "PHYSICS", grade: 5, waecTopics: ["physics.mechanics"] },
      client
    );
    // Grade 5 → skips WAEC candidates, uses the subject/band fallback strand.
    expect(res).toEqual({ subject: "SCIENCE", strandKey: "forces_motion", gradeBand: "G4_6" });
  });

  it("returns null when the subject has no strands at all", async () => {
    const client = fakeClient({ existing: new Set(), fallback: null });
    const res = await resolveMasteryStrandForLesson(
      { contentSubject: "PHYSICS", grade: 11, waecTopics: [] },
      client
    );
    expect(res).toBeNull();
  });
});
