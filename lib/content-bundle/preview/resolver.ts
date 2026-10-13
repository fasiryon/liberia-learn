/**
 * Teacher Preview display extension of the Wave 2B authority resolver contract.
 *
 * The preview surface renders whatever a resolver hands it. It never decides release state,
 * lab certification or toolkit review itself: those facts are not inside a ContentBundle and
 * belong to the read-only authority layer. The explicit local fixture adapter is non-authoritative.
 */
import type { ContentBundleResolution } from "../v1/resolver";
import type { ToolkitMappingIssue } from "../v1/toolkitMapping";

export type PreviewViewer = Readonly<{ userId: string; role: string; schoolId: string | null }>;

export type ContentBundlePreviewRequest = Readonly<{
  bundleId: string;
  /** Exact version; null yields a version-selection state without an authoritative default rule. */
  bundleVersion: string | null;
  viewer: PreviewViewer;
  schoolId?: string;
  fixturePreview?: boolean;
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

/** Display status of the consulted ontology release; never publishes or approves a bundle. */
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

export type PreviewAuthorityMetadata = Readonly<{
  readiness: "READY" | "PARTIAL" | "BLOCKED";
  objectiveDescriptions: Readonly<Record<string, string>>;
  offlinePackageClosed: false;
}>;

/** Wave 2B owns status/content/projection. Remaining properties are display metadata. */
export type ResolvedContentBundlePreview = Extract<ContentBundleResolution, { status: "RESOLVED" }> & Readonly<{
  source: PreviewSource;
  contentHash: string;
  authorityMetadata: PreviewAuthorityMetadata;
  labReadiness: Readonly<Record<string, LabReadiness>>;
  release: ReleaseStatus;
  toolkit: ToolkitResolution;
}>;

export type ContentBundlePreviewResolution =
  | ResolvedContentBundlePreview
  | (Extract<ContentBundleResolution, { status: "UNAVAILABLE" | "INCOMPATIBLE" }> & Readonly<{ authorityMetadata?: PreviewAuthorityMetadata }>);

export interface ContentBundlePreviewResolver {
  resolveForTeacherPreview(request: ContentBundlePreviewRequest): Promise<ContentBundlePreviewResolution>;
}
