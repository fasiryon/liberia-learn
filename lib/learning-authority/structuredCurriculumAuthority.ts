/**
 * Structured curriculum authority model (V1).
 *
 * Every structured curriculum item keeps four facts apart:
 *   1. source provenance   - which MOE document, member, page(s), and how the
 *                            text was obtained (decoded PDF text vs OCR);
 *   2. extraction quality  - parser, confidence, text quality flags;
 *   3. LiberiaLearn review - the platform's own human review state;
 *   4. MOE approval        - the Ministry's approval of LiberiaLearn's use.
 *
 * MOE source provenance is NOT MOE approval. An item parsed from a verified MOE
 * archive is `sourceAuthority: VERIFIED_LIBERIA_MOE_SOURCE` and
 * `moeApprovalState: NOT_CLAIMED` until a real Ministry decision is recorded
 * with evidence. Nothing in the parser or import path can set MOE approval.
 */

export type StructuredItemKind =
  | "OUTCOME"
  | "OBJECTIVE"
  | "CONTENT"
  | "ACTIVITY"
  | "MATERIAL"
  | "COMPETENCY"
  | "ASSESSMENT_REFERENCE";

export type ExtractionMethod =
  /** Text decoded from the PDF content stream with a font ToUnicode map. */
  | "PDF_TEXT_DECODED"
  /** Text decoded from the PDF content stream without a complete font map. */
  | "PDF_TEXT_UNMAPPED_FONT"
  /** Scanned page, rendered and recognised by Windows.Media.Ocr. */
  | "OCR_WINDOWS_MEDIA";

export type ExtractionConfidence = "HIGH" | "MEDIUM" | "LOW";

export type TextQualityFlag =
  | "LETTER_SPACING_ARTIFACTS"
  | "TAIL_BOUNDARY_UNCERTAIN"
  | "CONTINUATION_PAGE_ASSIGNMENT"
  | "AMBIGUOUS_COLUMN_ASSIGNMENT"
  | "OCR_TEXT"
  | "SOURCE_GRADE_OUT_OF_SEQUENCE"
  | "OBJECTIVE_LACKS_ACTION_VERB";

export type LiberiaLearnReviewState = "UNREVIEWED" | "IN_REVIEW" | "REVIEWED_ACCEPTED" | "REVIEWED_REJECTED";

export type MoeApprovalState = "NOT_CLAIMED" | "PENDING_MOE_REVIEW" | "MOE_APPROVED" | "MOE_REJECTED";

export type SourceProvenance = Readonly<{
  sourceAuthority: "VERIFIED_LIBERIA_MOE_SOURCE";
  archiveId: string;
  archiveDocument: string;
  sourceUri: string;
  archiveChecksum: string;
  sourceMember: string;
  memberChecksum: string | null;
  pages: readonly number[];
  extractionMethod: ExtractionMethod;
  parser: string;
}>;

export type MoeApprovalEvidence = Readonly<{
  /** Ministry letter, circular, or signed review record identifier. */
  reference: string;
  decidedAt: string;
  recordedByUserId: string;
}>;

export type StructuredCurriculumItem = Readonly<{
  id: string;
  kind: StructuredItemKind;
  grade: number;
  /** Canonical LiberiaLearn subject (MATH, LITERACY, SCIENCE, SOCIAL_STUDIES). */
  subject: string;
  /** Subject as named by the MOE document (e.g. BIOLOGY, HISTORY). */
  sourceSubject: string;
  semester: number | null;
  period: number | null;
  unit: string | null;
  topic: string;
  topicKey: string;
  ordinal: number;
  text: string;
  confidence: ExtractionConfidence;
  qualityFlags: readonly TextQualityFlag[];
  provenance: SourceProvenance;
  liberiaLearnReviewState: LiberiaLearnReviewState;
  moeApprovalState: MoeApprovalState;
  moeApprovalEvidence: MoeApprovalEvidence | null;
}>;

export type AuthorityViolation = Readonly<{ itemId: string; rule: string }>;

/** Invariants every structured item must satisfy before it can be bound. */
export function validateStructuredItem(item: StructuredCurriculumItem): AuthorityViolation[] {
  const violations: AuthorityViolation[] = [];
  const fail = (rule: string) => violations.push({ itemId: item.id, rule });
  if (!item.id.trim()) fail("id_required");
  if (!Number.isInteger(item.grade) || item.grade < 1 || item.grade > 12) fail("grade_invalid");
  if (!item.text.trim()) fail("text_required");
  if (!item.provenance.pages.length) fail("page_provenance_required");
  if (!item.provenance.sourceMember.trim() || !item.provenance.archiveChecksum.trim()) fail("source_identity_required");
  if (item.moeApprovalState === "MOE_APPROVED" && !item.moeApprovalEvidence) fail("moe_approval_requires_evidence");
  if (item.moeApprovalState !== "MOE_APPROVED" && item.moeApprovalEvidence) fail("moe_evidence_without_approval_state");
  if (item.provenance.extractionMethod === "OCR_WINDOWS_MEDIA" && !item.qualityFlags.includes("OCR_TEXT")) fail("ocr_text_flag_required");
  if (item.liberiaLearnReviewState === "REVIEWED_ACCEPTED" && item.confidence === "LOW") fail("low_confidence_cannot_be_accepted_without_correction");
  return violations;
}

/**
 * The only states an automated import may produce. Review and approval are
 * human decisions recorded elsewhere; importing never advances them.
 */
export const IMPORT_REVIEW_STATE: LiberiaLearnReviewState = "UNREVIEWED";
export const IMPORT_MOE_APPROVAL_STATE: MoeApprovalState = "NOT_CLAIMED";

/**
 * MOE objectives are written as "learners will: <verb> ...". A stem that is
 * not an action verb usually means a CONTENTS cell was numbered in sequence
 * with the objectives. Such items drop to MEDIUM and go to review.
 */
const ACTION_VERBS = new Set(("identify define describe explain discuss state list name write read solve find use apply compare " +
  "order add subtract multiply divide simplify estimate measure convert calculate construct draw demonstrate classify distinguish " +
  "differentiate analyze analyse evaluate interpret recognize recognise determine express represent perform show illustrate locate " +
  "outline examine investigate observe predict prepare practice practise relate round sort tell understand appreciate create design " +
  "develop organize organise plan present produce prove record summarize summarise trace graph plot count match label mention narrate " +
  "pronounce spell recite retell respond ask answer listen speak exchange greet make carry collect select compose give appraise assess " +
  "account justify factorize factorise expand integrate differentiate derive verify examine formulate interpret deduce infer utilize " +
  "utilise familiarize familiarise acquire recall review research explore arrange complete demonstrate discover reduce distribute keep " +
  "sketch take translate transform manipulate enumerate highlight elaborate contrast adopt resist know recognise obtain derive test " +
  "mark model generalize generalise define group form compute categorize categorise assist follow say sing participate change " +
  "report conjugate generate blend begin choose improve look think learn play help retell summarize summarise pronounce decode " +
  "segment rhyme copy fill connect join build solve divide multiply cut fold weigh check fix recognize name share role dramatize " +
  "debate interview visit care protect clean wash plant grow keep obey respect love").split(" "));

export function lacksActionVerb(text: string): boolean {
  // "Tell/read", "Retell/summarize": the first alternative is the verb.
  const first = text.trim().split(/[\s,;:(]+/)[0]?.split("/")[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return !ACTION_VERBS.has(first);
}

/** Items that may be bound as objective authority in an executable release. */
export function isBindableObjective(item: StructuredCurriculumItem): boolean {
  return item.kind === "OBJECTIVE" && item.confidence !== "LOW" && item.liberiaLearnReviewState !== "REVIEWED_REJECTED" &&
    validateStructuredItem(item).length === 0;
}
