/**
 * Canonical tool-binding identity, translated to runtime toolkit ids by an explicit adapter.
 *
 * Bundles bind canonical governed tool ids (the namespace tool policies use, e.g.
 * `fraction_strips`, `calculator`). The runtime toolkit registry uses different ids
 * (`fraction-visualizer`, `basic-calculator`, `scientific-calculator`). CONTENT_FACTORY_READINESS_V1
 * verified this mismatch and requires a reviewed, versioned mapping, with no spelling
 * normalization or implied equivalence. One canonical id may map to several runtime ids, for
 * example when a prohibition group covers both calculators.
 *
 * This module only checks a bundle against a supplied mapping. It does not decide that a mapping
 * is pedagogically reviewed, and it does not change the production toolkit.
 */
import type { ContentBundleV1 } from "./types";

export type ToolkitMapping = Readonly<{
  mappingId: string;
  mappingVersion: string;
  /** Canonical governed tool id to runtime registry ids. */
  entries: Readonly<Record<string, readonly string[]>>;
}>;

export type ToolkitMappingIssue = Readonly<{
  code: "toolkit_mapping_not_pinned" | "toolkit_mapping_mismatch" | "toolkit_tool_unmapped" | "toolkit_runtime_unknown";
  toolId: string | null;
  message: string;
}>;

/**
 * Check that every canonical tool the bundle binds resolves, through the pinned mapping, to
 * runtime ids the registry knows. An empty result means resolvable; it does not mean available,
 * because context, flags, policy and accommodations still intersect at runtime.
 */
export function checkToolkitMapping(
  bundle: ContentBundleV1,
  mapping: ToolkitMapping,
  isRuntimeToolId: (runtimeToolId: string) => boolean,
): ToolkitMappingIssue[] {
  const issues: ToolkitMappingIssue[] = [];
  if (bundle.toolkitBindings.length === 0) return issues;
  const pin = bundle.toolkitMapping;
  if (!pin) {
    issues.push({ code: "toolkit_mapping_not_pinned", toolId: null, message: "bundle binds tools but pins no reviewed toolkit mapping" });
    return issues;
  }
  if (pin.mappingId !== mapping.mappingId || pin.mappingVersion !== mapping.mappingVersion) {
    issues.push({ code: "toolkit_mapping_mismatch", toolId: null, message: `bundle pins ${pin.mappingId}@${pin.mappingVersion}, mapping is ${mapping.mappingId}@${mapping.mappingVersion}` });
    return issues;
  }
  for (const toolId of [...new Set(bundle.toolkitBindings.map((binding) => binding.toolId))].sort()) {
    const runtimeIds = Object.prototype.hasOwnProperty.call(mapping.entries, toolId) ? mapping.entries[toolId] : undefined;
    if (!runtimeIds || runtimeIds.length === 0) {
      issues.push({ code: "toolkit_tool_unmapped", toolId, message: `canonical tool "${toolId}" has no reviewed runtime mapping` });
      continue;
    }
    for (const runtimeId of runtimeIds) {
      if (!isRuntimeToolId(runtimeId)) issues.push({ code: "toolkit_runtime_unknown", toolId, message: `"${toolId}" maps to "${runtimeId}", which is not in the runtime toolkit registry` });
    }
  }
  return issues;
}

/** Runtime ids for one canonical tool, or an empty list when unmapped. Never guesses. */
export function resolveRuntimeToolIds(mapping: ToolkitMapping, canonicalToolId: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(mapping.entries, canonicalToolId) ? mapping.entries[canonicalToolId] : [];
}
