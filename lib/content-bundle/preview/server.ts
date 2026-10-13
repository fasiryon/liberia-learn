/**
 * Server-only resolver selection for the Teacher Preview route.
 *
 * Wave 2A ships no governed bundle store, so production has no resolver and the route says so
 * truthfully. Outside production the fixture adapter serves the synthetic Grade 4 fractions
 * fixture for product review. This is not a feature flag and not a release decision; Wave 2B
 * replaces this selection with the governed resolver.
 */
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";
import { createFixturePreviewResolver } from "./fixtureResolver";
import type { ContentBundlePreviewResolver } from "./resolver";

const unavailableResolver: ContentBundlePreviewResolver = {
  async resolveForTeacherPreview() {
    return { status: "RESOLVER_UNAVAILABLE", reason: "No governed ContentBundle resolver is configured in this environment yet." };
  },
};

export function getContentBundlePreviewResolver(env: Readonly<{ NODE_ENV?: string }> = process.env): ContentBundlePreviewResolver {
  if (env.NODE_ENV === "production") return unavailableResolver;
  return createFixturePreviewResolver({ runtimeTools: Object.fromEntries(TOOL_REGISTRY_DEFINITIONS.map((tool) => [tool.id, tool.name])) });
}
