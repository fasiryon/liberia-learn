/**
 * Grade 4 Math governed release 2026.2 (CANDIDATE).
 *
 * Release 2026.1 (GRADE4_MATH_ONTOLOGY_RELEASE) is immutable: its identity
 * hash can be persisted in learner evidence, so a repair or extension is a new
 * release, never an edit. 2026.2 is composed deterministically from:
 *
 *   - every 2026.1 concept, item, binding and policy, carried forward verbatim
 *     (same ids and versions, so an item's meaning never changes under an id);
 *   - reviewed additions, each gated on a founder APPROVE decision in
 *     curriculum/review/g4-math/review-ledger.json for its MOE objective;
 *   - a release-level founder approval that names the exact identity approved.
 *
 * Without that approval the release stays IN_REVIEW / PENDING, which
 * validateOntologyRelease refuses, so nothing here can reach a learner. The
 * composer never records a decision; the ledger and the approval are human
 * inputs. DRAFT_UNREVIEWED lessons are never included: a draft needs an
 * APPROVE decision AND an authored promotion (concept + governed items), and
 * no draft has one yet.
 */
import { createHash } from "crypto";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity,
  type CurriculumConstructBinding, type CurriculumContentBinding, type CurriculumOntologyRelease, type GovernedItem,
} from "../governedGrade4Math";
import { GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";

export const GRADE4_MATH_RELEASE_2026_2_ID = "lr-moe-g4-math-2026.2";
const PARTS_OF_A_SET = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";

export type LedgerDecision = "PENDING" | "APPROVE" | "REVISE" | "REJECT";
export type ReviewLedger = Readonly<Record<string, Readonly<{ decision: LedgerDecision; reviewer: string | null; reviewedAt: string | null; notes: string }>>>;

/** A founder's release-level approval, recorded by a human outside this module. */
export type ReleaseApproval = Readonly<{ releaseId: string; approvedIdentity: string; reviewer: string; reviewedAt: string }>;

type Addition = Readonly<{
  moeObjectiveId: string;
  items: readonly GovernedItem[];
  bindings: readonly CurriculumConstructBinding[];
  contentBindings: readonly CurriculumContentBinding[];
  lesson: Readonly<{ contentId: string; version: string; payload: unknown }> | null;
  /** Which 2026.1 content binding this addition replaces, if any. */
  replacesContentBindingId: string | null;
}>;

const equalPartsBinding = (id: string, itemId: string): CurriculumConstructBinding => ({
  id, itemId, itemVersion: "1.0.0", conceptId: "g4-fractions-equal-parts", skillId: "placement-skill-MATH-G4_6",
  learningTargetCode: "LR-MATH-G4_6-02", standardCode: "LR-MATH-G4_6-02",
  evidencePolicyId: "g4-math-practice-evidence", toolPolicyId: "g4-math-practice-tools",
});

export function lessonPayloadSha256(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** The reviewed-content additions 2026.2 can carry. Each is included only when its objective is APPROVED. */
export const GRADE4_MATH_2026_2_ADDITIONS: readonly Addition[] = Object.freeze([
  {
    moeObjectiveId: PARTS_OF_A_SET,
    items: [
      { id: "g4-frac-practice-part-of-whole", version: "1.0.0", context: "PRACTICE",
        prompt: "A cassava bread is cut into 8 equal pieces. 3 pieces are eaten. What fraction is eaten?",
        options: ["3/8", "5/8", "3/5", "8/3"], correctIndex: 0,
        hint: "The denominator counts the equal pieces in the whole bread.", workedExample: "8 equal pieces make the whole, so the denominator is 8. 3 pieces are eaten, so the fraction is 3/8." },
      { id: "g4-frac-practice-part-of-set", version: "1.0.0", context: "PRACTICE",
        prompt: "There are 5 bottle caps. 2 are red. What fraction of the caps are red?",
        options: ["2/5", "3/5", "2/3", "5/2"], correctIndex: 0,
        hint: "The whole is the set of all 5 caps.", workedExample: "The set has 5 caps, so the denominator is 5. 2 caps are red, so 2/5 of the caps are red." },
      { id: "g4-frac-practice-unequal-parts", version: "1.0.0", context: "PRACTICE",
        prompt: "A cloth is cut into 4 pieces of different sizes. Can one piece be called 1/4 of the cloth?",
        options: ["No, the parts must be equal", "Yes, there are 4 pieces", "Yes, any piece is 1/4", "Only the biggest piece"], correctIndex: 0,
        hint: "Fractions of a whole name equal parts.", workedExample: "1/4 means one of 4 equal parts. These pieces are different sizes, so none of them is 1/4." },
      { id: "g4-frac-check-denominator-meaning", version: "1.0.0", context: "PRACTICE",
        prompt: "In 3/4, what does the 4 tell us?",
        options: ["How many equal parts make the whole", "How many parts are selected", "How many wholes there are", "The answer to an addition problem"], correctIndex: 0 },
    ],
    bindings: [
      equalPartsBinding("g4-frac-bind-part-of-whole-v1", "g4-frac-practice-part-of-whole"),
      equalPartsBinding("g4-frac-bind-part-of-set-v1", "g4-frac-practice-part-of-set"),
      equalPartsBinding("g4-frac-bind-unequal-parts-v1", "g4-frac-practice-unequal-parts"),
      equalPartsBinding("g4-frac-bind-denominator-meaning-v1", "g4-frac-check-denominator-meaning"),
    ],
    contentBindings: [{
      id: "g4-frac-content-bind-equal-parts-v2", conceptId: "g4-fractions-equal-parts",
      contentId: GRADE4_FRACTIONS_LESSON_2026_2.contentId, contentVersion: GRADE4_FRACTIONS_LESSON_2026_2.version,
      contentType: "LESSON", toolPolicyId: "g4-math-instruction-tools",
      contentSha256: lessonPayloadSha256(GRADE4_FRACTIONS_LESSON_2026_2.payload),
    }],
    lesson: GRADE4_FRACTIONS_LESSON_2026_2,
    replacesContentBindingId: "g4-frac-content-bind-equal-parts-v1",
  },
]);

export type ReleaseManifestEntry = Readonly<{ moeObjectiveId: string; kind: "LESSON" | "ITEM"; id: string; version: string; sha256: string }>;
export type ReleaseExclusion = Readonly<{ moeObjectiveId: string; id: string; reason: string }>;

export type ComposedRelease = Readonly<{
  release: CurriculumOntologyRelease;
  /** The identity this release will have once PUBLISHED/APPROVED: what a founder approves. */
  approvableIdentity: string;
  carriedForwardFrom: Readonly<{ releaseId: string; identity: string }>;
  included: readonly ReleaseManifestEntry[];
  excluded: readonly ReleaseExclusion[];
  executable: boolean;
}>;

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function composeGrade4MathRelease2026_2(input: { ledger: ReviewLedger; approval?: ReleaseApproval | null }): ComposedRelease {
  const base = GRADE4_MATH_ONTOLOGY_RELEASE;
  const approved = (objectiveId: string) => input.ledger[objectiveId]?.decision === "APPROVE";
  const accepted = GRADE4_MATH_2026_2_ADDITIONS.filter((addition) => approved(addition.moeObjectiveId));
  const excluded: ReleaseExclusion[] = [];
  for (const addition of GRADE4_MATH_2026_2_ADDITIONS.filter((entry) => !approved(entry.moeObjectiveId))) {
    const decision = input.ledger[addition.moeObjectiveId]?.decision ?? "MISSING";
    for (const id of [...(addition.lesson ? [addition.lesson.contentId] : []), ...addition.items.map((item) => item.id)]) {
      excluded.push({ moeObjectiveId: addition.moeObjectiveId, id, reason: `ledger decision ${decision}; only APPROVE is included` });
    }
  }
  for (const draft of GRADE4_MATH_DRAFT_LESSONS) {
    const decision = input.ledger[draft.moeObjectiveId]?.decision ?? "MISSING";
    excluded.push({ moeObjectiveId: draft.moeObjectiveId, id: draft.contentId, reason: decision === "APPROVE"
      ? "APPROVED draft has no authored promotion (concept + governed items) yet"
      : `DRAFT_UNREVIEWED, ledger decision ${decision}` });
  }

  const replaced = new Set(accepted.map((addition) => addition.replacesContentBindingId).filter((id): id is string => id !== null));
  const candidate = {
    ...base,
    id: GRADE4_MATH_RELEASE_2026_2_ID,
    version: "2026.2",
    provenanceRef: "Standard:LR-MATH-G4_6-02;structured-moe:curriculum/structured/moe-structured-v1.json;ledger:curriculum/review/g4-math/review-ledger.json",
    items: [...base.items, ...accepted.flatMap((addition) => addition.items)],
    bindings: [...base.bindings, ...accepted.flatMap((addition) => addition.bindings)],
    contentBindings: [...base.contentBindings.filter((binding) => !replaced.has(binding.id)), ...accepted.flatMap((addition) => addition.contentBindings)],
  };
  const approvable: CurriculumOntologyRelease = { ...candidate, status: "PUBLISHED", reviewStatus: "APPROVED" };
  const approvableIdentity = deterministicReleaseIdentity(approvable);
  const approval = input.approval ?? null;
  const executable = approval !== null && approval.releaseId === GRADE4_MATH_RELEASE_2026_2_ID &&
    approval.approvedIdentity === approvableIdentity && !!approval.reviewer.trim() && Number.isFinite(Date.parse(approval.reviewedAt)) &&
    accepted.length > 0;
  const release: CurriculumOntologyRelease = executable ? approvable : { ...candidate, status: "IN_REVIEW", reviewStatus: "PENDING" };

  const included: ReleaseManifestEntry[] = [
    ...base.items.map((item) => ({ moeObjectiveId: "carried-forward:2026.1", kind: "ITEM" as const, id: item.id, version: item.version, sha256: sha(item) })),
    ...base.contentBindings.filter((binding) => !replaced.has(binding.id)).map((binding) => ({ moeObjectiveId: "carried-forward:2026.1", kind: "LESSON" as const, id: binding.contentId, version: binding.contentVersion, sha256: binding.contentSha256 ?? "unpinned-in-2026.1" })),
    ...accepted.flatMap((addition) => [
      ...(addition.lesson ? [{ moeObjectiveId: addition.moeObjectiveId, kind: "LESSON" as const, id: addition.lesson.contentId, version: addition.lesson.version, sha256: lessonPayloadSha256(addition.lesson.payload) }] : []),
      ...addition.items.map((item) => ({ moeObjectiveId: addition.moeObjectiveId, kind: "ITEM" as const, id: item.id, version: item.version, sha256: sha(item) })),
    ]),
  ];
  return Object.freeze({
    release, approvableIdentity,
    carriedForwardFrom: { releaseId: base.id, identity: deterministicReleaseIdentity(base) },
    included, excluded, executable,
  });
}
