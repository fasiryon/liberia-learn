/**
 * ContentBundle V1 foundation: pure contract, validator, hash, seal, learner projection and
 * toolkit mapping adapter, reconciled with CONTENT_FACTORY_READINESS_V1. No persistence, routes or
 * production consumers yet.
 */
export * from "./types";
export { validateContentBundle, type ContentBundleValidationOptions } from "./validator";
export { CONTENT_BUNDLE_HASH_DOMAIN, contentBundleHashPayload, hashContentBundle } from "./hash";
export { sealContentBundle, type SealedContentBundle } from "./seal";
export { checkToolkitMapping, resolveRuntimeToolIds, type ToolkitMapping, type ToolkitMappingIssue } from "./toolkitMapping";
export {
  governedContentRef,
  LEARNER_PROJECTION_VERSION,
  projectLearnerBundle,
  projectLearnerContentBundle,
  type LearnerActivity,
  type LearnerAssessmentReference,
  type LearnerContentBundle,
  type LearnerInstructionStep,
  type LearnerResource,
  type LearnerToolBinding,
} from "./projection";
