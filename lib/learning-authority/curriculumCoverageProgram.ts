import { getCanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";
import { publishedReleases } from "./publishedReleases";
import { documentedSourceCells, sourceBackedCells } from "./repositorySourceInventory";

export type AuthoritySourceRecord = Readonly<{
  id: string;
  authorityType: string;
  status: string;
  subject: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
  verificationStatus: string | null;
  currentVersionId: string | null;
}>;

export type ContentCoverageRecord = Readonly<{
  grade: number;
  subject: string;
  status: string;
  contentId: string;
  version: string;
  provenanceCompleteness: string | null;
  lifecycleState: string | null;
  originKind: string | null;
  reviewAuthorities: readonly string[];
}>;

export type ObjectiveCoverageRecord = Readonly<{
  grade: number;
  subject: string;
  sourceVersionId: string;
  verificationStatus: string;
}>;

export type CoverageProgramScope = Readonly<{ grades: readonly number[]; subjects: readonly string[] }>;

export type CoverageProgramCell = Readonly<{
  grade: number;
  subject: string;
  authoritativeSourceCount: number;
  verifiedObjectiveCount: number;
  approvedLessonCount: number;
  founderReviewedCount: number;
  moeReviewedCount: number;
  executableReleaseCount: number;
  gaps: readonly string[];
  reviewQueue: Readonly<{ kind: "SOURCE_IMPORT" | "CONTENT_REVIEW" | "ASSESSMENT_BINDING"; reason: string }>;
}>;

export type CurriculumCoverageProgramReport = Readonly<{
  generatedAt: string;
  scope: Readonly<{ grades: readonly number[]; subjects: readonly string[]; combinations: number }>;
  counts: Readonly<{ populated: number; authoritativeSource: number; founderReviewed: number; unresolvedSourceGaps: number; lessonGaps: number; assessmentGaps: number }>;
  coverage: Readonly<{
    totalCombinations: number;
    sourceBackedCombinations: number;
    importedManifestCombinations: number;
    executableReleaseCombinations: number;
    founderReviewedCombinations: number;
    moeApprovedCombinations: number | null;
    unresolvedCombinations: number;
    lessonGaps: number;
    assessmentGaps: number;
    evidencePolicyGaps: number;
    toolPolicyGaps: number;
  }>;
  cells: readonly CoverageProgramCell[];
}>;

export function buildRepositoryOnlyCoverageReport(input: {
  scope: CoverageProgramScope;
  databaseError: string;
}): Readonly<{
  generatedAt: string;
  availability: { mode: "REPOSITORY_ONLY"; database: "UNAVAILABLE"; reason: string };
  scope: { grades: readonly number[]; subjects: readonly string[]; combinations: number };
  repository: { populatedCombinations: number; registeredReleaseCombinations: number };
  databaseDependent: { authoritativeSourceCount: null; verifiedObjectiveCount: null; approvedLessonCount: null; founderReviewedContentCount: null; moeApprovedContentCount: null };
  coverage: {
    totalCombinations: number;
    sourceBackedCombinations: number;
    importedManifestCombinations: number;
    executableReleaseCombinations: number;
    founderReviewedCombinations: number;
    moeApprovedCombinations: null;
    unresolvedCombinations: number;
    lessonGaps: number;
    assessmentGaps: number;
    evidencePolicyGaps: number;
    toolPolicyGaps: number;
  };
  cells: readonly Readonly<{ grade: number; subject: string; executableRelease: boolean; gaps: readonly string[]; reviewQueue: Readonly<{ kind: "SOURCE_IMPORT" | "CONTENT_REVIEW" | "ASSESSMENT_BINDING"; reason: string }> }>[];
}> {
  const releases = publishedReleases();
  const documentedCells = new Set(documentedSourceCells(input.scope));
  const sourceCells = new Set(sourceBackedCells(input.scope));
  const cells = input.scope.grades.flatMap((grade) => input.scope.subjects.map((subject) => {
    const release = releases.find((candidate) => candidate.grade === grade && candidate.subject === subject);
    const gaps = release
      ? [
          ...(release.contentBindings.some((binding) => binding.contentType === "LESSON") ? [] : ["LESSON"]),
          ...(release.bindings.length ? [] : ["ASSESSMENT"]),
          ...(release.evidencePolicies.length ? [] : ["EVIDENCE_POLICY"]),
          ...(release.toolPolicies.length ? [] : ["TOOL_POLICY"]),
        ]
      : ["RELEASE", "LESSON", "ASSESSMENT", "EVIDENCE_POLICY", "TOOL_POLICY"];
    return {
      grade, subject, executableRelease: Boolean(release), gaps,
      reviewQueue: release
        ? { kind: "CONTENT_REVIEW" as const, reason: "Repository release exists; live content/source evidence is unavailable." }
        : documentedCells.has(`${grade}:${subject}`)
          ? { kind: "SOURCE_IMPORT" as const, reason: sourceCells.has(`${grade}:${subject}`) ? "Repository source bytes are importable." : "Repository contains source provenance metadata, but source bytes are not committed; import remains unresolved." }
          : { kind: "SOURCE_IMPORT" as const, reason: "Database unavailable; source presence is UNKNOWN, not absent." },
    };
  }));
  const registeredReleaseCombinations = cells.filter((cell) => cell.executableRelease).length;
  return {
    generatedAt: new Date().toISOString(),
    availability: { mode: "REPOSITORY_ONLY", database: "UNAVAILABLE", reason: input.databaseError },
    scope: { ...input.scope, combinations: input.scope.grades.length * input.scope.subjects.length },
    repository: { populatedCombinations: registeredReleaseCombinations, registeredReleaseCombinations },
    databaseDependent: { authoritativeSourceCount: null, verifiedObjectiveCount: null, approvedLessonCount: null, founderReviewedContentCount: null, moeApprovedContentCount: null },
    coverage: {
      totalCombinations: cells.length,
      sourceBackedCombinations: documentedCells.size,
      importedManifestCombinations: 0,
      executableReleaseCombinations: registeredReleaseCombinations,
      founderReviewedCombinations: registeredReleaseCombinations,
      moeApprovedCombinations: null,
      unresolvedCombinations: cells.filter((cell) => cell.gaps.length > 0).length,
      lessonGaps: cells.filter((cell) => cell.gaps.includes("LESSON")).length,
      assessmentGaps: cells.filter((cell) => cell.gaps.includes("ASSESSMENT")).length,
      evidencePolicyGaps: cells.filter((cell) => cell.gaps.includes("EVIDENCE_POLICY")).length,
      toolPolicyGaps: cells.filter((cell) => cell.gaps.includes("TOOL_POLICY")).length,
    },
    cells,
  };
}

const APPROVED_CONTENT_STATUSES = new Set(["APPROVED", "published"]);

function subjectMatches(value: string | null | undefined, subject: string): boolean {
  return value ? (getCanonicalSubjectCode(value) ?? value.toUpperCase()) === subject : false;
}

function sourceCovers(source: AuthoritySourceRecord, grade: number, subject: string): boolean {
  return source.authorityType === "LIBERIA_MOE" && source.status === "ACTIVE" && source.currentVersionId !== null &&
    source.verificationStatus === "VERIFIED" && subjectMatches(source.subject, subject) &&
    (source.gradeMin === null || grade >= source.gradeMin) && (source.gradeMax === null || grade <= source.gradeMax);
}

function contentIsApproved(content: ContentCoverageRecord): boolean {
  return APPROVED_CONTENT_STATUSES.has(content.status) && content.provenanceCompleteness !== "UNVERIFIED" && content.lifecycleState === "APPROVED";
}

function contentIsFounderReviewed(content: ContentCoverageRecord): boolean {
  return contentIsApproved(content) && content.reviewAuthorities.includes("PLATFORM");
}

function contentIsMoeReviewed(content: ContentCoverageRecord): boolean {
  return contentIsApproved(content) && content.reviewAuthorities.includes("MOE");
}

export function buildCurriculumCoverageProgramReport(input: {
  scope: CoverageProgramScope;
  sources: readonly AuthoritySourceRecord[];
  objectives: readonly ObjectiveCoverageRecord[];
  content: readonly ContentCoverageRecord[];
}): CurriculumCoverageProgramReport {
  const releases = publishedReleases();
  const cells = input.scope.grades.flatMap((grade) => input.scope.subjects.map((subject) => {
    const sources = input.sources.filter((source) => sourceCovers(source, grade, subject));
    const objectives = input.objectives.filter((objective) => objective.grade === grade && subjectMatches(objective.subject, subject) && objective.verificationStatus === "VERIFIED");
    const content = input.content.filter((item) => item.grade === grade && subjectMatches(item.subject, subject) && contentIsApproved(item));
    const founderReviewedCount = content.filter(contentIsFounderReviewed).length;
    const moeReviewedCount = content.filter(contentIsMoeReviewed).length;
    const executableReleaseCount = releases.filter((release) => release.grade === grade && release.subject === subject).length;
    const gaps = [
      ...(sources.length ? [] : ["AUTHORITATIVE_SOURCE"]),
      ...(objectives.length ? [] : ["STANDARDS_OR_OBJECTIVES"]),
      ...(content.length ? [] : ["LESSON"]),
      ...(executableReleaseCount ? [] : ["RELEASE", "ASSESSMENT", "EVIDENCE_POLICY", "TOOL_POLICY"]),
      ...(moeReviewedCount ? [] : ["MOE_CONTENT_REVIEW"]),
    ];
    return {
      grade, subject, authoritativeSourceCount: sources.length, verifiedObjectiveCount: objectives.length,
      approvedLessonCount: content.length, founderReviewedCount, moeReviewedCount, executableReleaseCount, gaps,
      reviewQueue: sources.length === 0
        ? { kind: "SOURCE_IMPORT" as const, reason: "No active verified Liberia MOE source covers this grade/subject." }
        : !executableReleaseCount
          ? { kind: "ASSESSMENT_BINDING" as const, reason: "Authority source exists but no executable governed release is registered." }
          : content.length === 0
            ? { kind: "CONTENT_REVIEW" as const, reason: "Executable release lacks an approved lesson binding target." }
            : { kind: "CONTENT_REVIEW" as const, reason: "Coverage exists; inspect remaining concept-level bindings and review status." },
    } satisfies CoverageProgramCell;
  }));
  const populated = cells.filter((cell) => cell.authoritativeSourceCount > 0 || cell.approvedLessonCount > 0).length;
  return {
    generatedAt: new Date().toISOString(),
    scope: { ...input.scope, combinations: input.scope.grades.length * input.scope.subjects.length },
    counts: {
      populated,
      authoritativeSource: cells.filter((cell) => cell.authoritativeSourceCount > 0).length,
      founderReviewed: cells.filter((cell) => cell.founderReviewedCount > 0).length,
      unresolvedSourceGaps: cells.filter((cell) => cell.gaps.includes("AUTHORITATIVE_SOURCE")).length,
      lessonGaps: cells.filter((cell) => cell.gaps.includes("LESSON")).length,
      assessmentGaps: cells.filter((cell) => cell.gaps.includes("ASSESSMENT")).length,
    },
    coverage: {
      totalCombinations: cells.length,
      sourceBackedCombinations: cells.filter((cell) => cell.authoritativeSourceCount > 0).length,
      importedManifestCombinations: 0,
      executableReleaseCombinations: cells.filter((cell) => cell.executableReleaseCount > 0).length,
      founderReviewedCombinations: cells.filter((cell) => cell.founderReviewedCount > 0).length,
      moeApprovedCombinations: cells.filter((cell) => cell.moeReviewedCount > 0).length,
      unresolvedCombinations: cells.filter((cell) => cell.gaps.length > 0).length,
      lessonGaps: cells.filter((cell) => cell.gaps.includes("LESSON")).length,
      assessmentGaps: cells.filter((cell) => cell.gaps.includes("ASSESSMENT")).length,
      evidencePolicyGaps: cells.filter((cell) => cell.gaps.includes("EVIDENCE_POLICY")).length,
      toolPolicyGaps: cells.filter((cell) => cell.gaps.includes("TOOL_POLICY")).length,
    },
    cells,
  };
}
