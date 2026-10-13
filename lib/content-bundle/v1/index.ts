/**
 * ContentBundle V1 foundation (PROVISIONAL). Pure contract, validator, hash and learner
 * projection. No persistence, routes or production consumers yet.
 */
export * from "./types";
export { validateContentBundle, type ContentBundleValidationOptions } from "./validator";
export { CONTENT_BUNDLE_HASH_DOMAIN, contentBundleHashPayload, hashContentBundle, sealContentBundle, type SealedContentBundle } from "./hash";
export {
  governedContentRef,
  projectLearnerBundle,
  projectLearnerContentBundle,
  type LearnerActivity,
  type LearnerAssessmentReference,
  type LearnerContentBundle,
  type LearnerInstructionStep,
  type LearnerResource,
  type LearnerToolBinding,
} from "./projection";
