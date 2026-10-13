import type { ResolverDiagnostic } from "../v1/resolver";

/** Teacher-safe messages only; never echo paths, provider errors, or caller-supplied text. */
const MESSAGES: Readonly<Record<string, string>> = {
  PREVIEW_FORBIDDEN: "Your account cannot preview content outside its school context.",
  PREVIEW_SCOPE_UNAVAILABLE: "This content is not available within your school preview scope.",
  VERSION_SELECTION_REQUIRED: "An exact bundle version is required; no reviewed default version is available.",
  EXACT_IDENTITY_REQUIRED: "Use an exact bundle identity and version. Latest is not classroom authority.",
  FIXTURE_NOT_AUTHORITY: "Synthetic fixtures are not available through production authority.",
  AUTHORITY_UNDECLARED: "The content source has not declared governed authority, so it is not shown in production.",
  COMPOSITION_MISSING: "Production bundle not yet sealed: no immutable composition is available.",
  ASSESSMENT_DEFINITION_MISSING: "Assessment authority incomplete: a reviewed definition is missing.",
  ASSESSMENT_IDENTITY_INVALID: "Assessment authority incomplete: exact definition or item identity cannot be resolved.",
  SET_SPECIFIC_ASSESSMENT_BANK_GAP: "Assessment bank gap: reviewed parts-of-a-set items are incomplete.",
  MISSING_GOVERNED_ITEM_IDENTITY: "Legacy assessment has no governed item identity.",
  ANSWER_BEARING_LEGACY_STORE: "Legacy assessment material requires a separate governed, keyless adapter.",
  ASSESSMENT_VERSION_PIN_MISSING: "Assessment item is missing an exact version pin.",
  TOOLKIT_MAPPING_UNRESOLVED: "Toolkit mapping not yet reviewed: mapping unresolved.",
  LAB_REVISION_CERTIFICATION_UNRESOLVED: "Lab unavailable: stable link revision and certification are unresolved.",
  OFFLINE_PACKAGE_GAP: "Offline package not yet closed: not yet ready.",
  LESSON_PAYLOAD_HASH_MISSING: "Lesson payload is missing its released hash pin.",
  EXACT_APPROVED_REVISION_UNVERIFIED: "The exact stored approved lesson revision has not been verified.",
  SOURCE_VERSION_RIGHTS_UNVERIFIED: "Source version and resource rights still require verification.",
  ACTIVITY_DEFINITION_REVISION_GAP: "Reviewed activity definition revisions are incomplete.",
  RESOURCE_MEDIA_REVISION_GAP: "Resource and media revisions are incomplete.",
};

const FALLBACK_MESSAGE = "An authority dependency could not be safely resolved.";

export function teacherDiagnosticMessages(diagnostics: readonly ResolverDiagnostic[]): readonly string[] {
  return [...new Set(diagnostics.map(d => MESSAGES[d.code] ?? FALLBACK_MESSAGE))];
}

/**
 * Why something is missing matters to a teacher: content that does not exist yet, content that
 * exists but has not been reviewed, content that cannot be resolved safely, and content that is
 * outside this account's access are different situations. Unknown codes are "not resolvable".
 */
export type DiagnosticCategory = "NOT_AVAILABLE" | "NOT_BUILT" | "NOT_APPROVED" | "NOT_RESOLVABLE";

const CATEGORY_LABELS: Readonly<Record<DiagnosticCategory, string>> = {
  NOT_AVAILABLE: "Not available to you here",
  NOT_BUILT: "Not built yet",
  NOT_APPROVED: "Not reviewed or approved yet",
  NOT_RESOLVABLE: "Cannot be resolved safely",
};
const CATEGORY_ORDER: readonly DiagnosticCategory[] = ["NOT_AVAILABLE", "NOT_BUILT", "NOT_APPROVED", "NOT_RESOLVABLE"];

const CATEGORIES: Readonly<Record<string, DiagnosticCategory>> = {
  PREVIEW_FORBIDDEN: "NOT_AVAILABLE",
  PREVIEW_SCOPE_UNAVAILABLE: "NOT_AVAILABLE",
  FIXTURE_NOT_AUTHORITY: "NOT_AVAILABLE",
  AUTHORITY_UNDECLARED: "NOT_AVAILABLE",
  COMPOSITION_MISSING: "NOT_BUILT",
  ASSESSMENT_DEFINITION_MISSING: "NOT_BUILT",
  SET_SPECIFIC_ASSESSMENT_BANK_GAP: "NOT_BUILT",
  MISSING_GOVERNED_ITEM_IDENTITY: "NOT_BUILT",
  ANSWER_BEARING_LEGACY_STORE: "NOT_BUILT",
  ASSESSMENT_VERSION_PIN_MISSING: "NOT_BUILT",
  LESSON_PAYLOAD_HASH_MISSING: "NOT_BUILT",
  ACTIVITY_DEFINITION_REVISION_GAP: "NOT_BUILT",
  RESOURCE_MEDIA_REVISION_GAP: "NOT_BUILT",
  OFFLINE_PACKAGE_GAP: "NOT_BUILT",
  TOOLKIT_MAPPING_UNRESOLVED: "NOT_APPROVED",
  LAB_REVISION_CERTIFICATION_UNRESOLVED: "NOT_APPROVED",
  EXACT_APPROVED_REVISION_UNVERIFIED: "NOT_APPROVED",
  SOURCE_VERSION_RIGHTS_UNVERIFIED: "NOT_APPROVED",
  VERSION_SELECTION_REQUIRED: "NOT_RESOLVABLE",
  EXACT_IDENTITY_REQUIRED: "NOT_RESOLVABLE",
  ASSESSMENT_IDENTITY_INVALID: "NOT_RESOLVABLE",
};

export type DiagnosticGroup = Readonly<{ category: DiagnosticCategory; label: string; messages: readonly string[] }>;

export function teacherDiagnosticGroups(diagnostics: readonly ResolverDiagnostic[]): readonly DiagnosticGroup[] {
  const grouped = new Map<DiagnosticCategory, Set<string>>();
  for (const d of diagnostics) {
    const category = CATEGORIES[d.code] ?? "NOT_RESOLVABLE";
    const set = grouped.get(category) ?? new Set<string>();
    set.add(MESSAGES[d.code] ?? FALLBACK_MESSAGE);
    grouped.set(category, set);
  }
  return CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => ({ category, label: CATEGORY_LABELS[category], messages: [...grouped.get(category)!] }));
}
