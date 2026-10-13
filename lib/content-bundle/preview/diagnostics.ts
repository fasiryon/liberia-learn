import type { ResolverDiagnostic } from "../v1/resolver";

/** Teacher-safe messages only; never echo paths, provider errors, or caller-supplied text. */
const MESSAGES: Readonly<Record<string, string>> = {
  PREVIEW_FORBIDDEN: "Your account cannot preview content outside its school context.",
  PREVIEW_SCOPE_UNAVAILABLE: "This content is not available within your school preview scope.",
  VERSION_SELECTION_REQUIRED: "An exact bundle version is required; no reviewed default version is available.",
  EXACT_IDENTITY_REQUIRED: "Use an exact bundle identity and version. Latest is not classroom authority.",
  FIXTURE_NOT_AUTHORITY: "Synthetic fixtures are not available through production authority.",
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

export function teacherDiagnosticMessages(diagnostics: readonly ResolverDiagnostic[]): readonly string[] {
  return [...new Set(diagnostics.map(d => MESSAGES[d.code] ?? "An authority dependency could not be safely resolved."))];
}
