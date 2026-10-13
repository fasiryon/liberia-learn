/**
 * Teacher Preview resolver seam (ContentBundle Wave 2A).
 *
 * The preview surface renders whatever a resolver hands it. It never decides release state,
 * lab certification or toolkit review itself: those facts are not inside a ContentBundle and
 * belong to the authority layer that Wave 2B builds. Until then, a fixture adapter implements this
 * interface and says plainly that it did not consult those authorities.
 */
import type { ContentBundleV1, ContentBundleValidationError } from "../v1/types";
import type { LearnerContentBundle } from "../v1/projection";
import type { ToolkitMappingIssue } from "../v1/toolkitMapping";

export type PreviewViewer = Readonly<{ userId: string; role: string; schoolId: string | null }>;

export type ContentBundlePreviewRequest = Readonly<{
  bundleId: string;
  /** Exact version; null asks the resolver for the version it would preview by default. */
  bundleVersion: string | null;
  viewer: PreviewViewer;
}>;

/**
 * Where the resolved bundle came from. `authoritative: false` means the content is not backed by a
 * governed bundle store, so the UI must label it as such.
 */
export type PreviewSource = Readonly<{ kind: "FIXTURE" | "GOVERNED_STORE"; label: string; authoritative: boolean }>;

/**
 * Runnability of one lab member, decided by the lab registry and link governance, never by the
 * bundle. Only CERTIFIED_RUNNABLE may be shown as runnable.
 */
export type LabReadiness = Readonly<{
  state: "CERTIFIED_RUNNABLE" | "NOT_CERTIFIED" | "LINK_REVISION_MISSING" | "NOT_EVALUATED";
  /** Plain-language reason a teacher can read. */
  reason: string;
}>;

/** Release status of the exact sealed (bundleId, version, contentHash), from release governance. */
export type ReleaseStatus =
  | Readonly<{ state: "NOT_EVALUATED"; reason: string }>
  | Readonly<{ state: "UNRELEASED"; reason: string }>
  | Readonly<{ state: "RELEASED"; releaseRef: string; reason: string }>;

export type ToolkitResolution = Readonly<{
  /** The pinned mapping the resolver checked against, if it had one. */
  mapping: Readonly<{ mappingId: string; mappingVersion: string; reviewed: boolean; entries: Readonly<Record<string, readonly string[]>> }> | null;
  /** Runtime tool display names, keyed by runtime tool id, for ids the runtime registry knows. */
  runtimeToolNames: Readonly<Record<string, string>>;
  issues: readonly ToolkitMappingIssue[];
}>;

export type ResolvedContentBundlePreview = Readonly<{
  status: "RESOLVED";
  source: PreviewSource;
  /** Validated and sealed bundle. */
  bundle: ContentBundleV1;
  contentHash: string;
  /** Output of `projectLearnerBundle` for the same sealed bundle; Student View renders only this. */
  learnerBundle: LearnerContentBundle;
  labReadiness: Readonly<Record<string, LabReadiness>>;
  release: ReleaseStatus;
  toolkit: ToolkitResolution;
}>;

export type ContentBundlePreviewResolution =
  | ResolvedContentBundlePreview
  | Readonly<{ status: "NOT_FOUND"; bundleId: string }>
  | Readonly<{ status: "FORBIDDEN" }>
  | Readonly<{ status: "INVALID"; bundleId: string; errors: readonly ContentBundleValidationError[] }>
  | Readonly<{ status: "RESOLVER_UNAVAILABLE"; reason: string }>;

export interface ContentBundlePreviewResolver {
  resolveForTeacherPreview(request: ContentBundlePreviewRequest): Promise<ContentBundlePreviewResolution>;
}
