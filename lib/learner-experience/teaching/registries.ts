/**
 * The one version dispatcher for Visual Teaching Block Registries (CoS 1.3.0 ruling): a package is validated with the
 * registry it was sealed under, and nothing else. 1.1.0 resolves to ./registry.ts, 1.2.0 to ./registry-1.2.ts and 1.3.0
 * to ./registry-1.3.ts, each through its own unchanged validator, so a 1.1.0 or 1.2.0 package validates exactly as
 * before. An undeclared or unknown version fails closed: no fallback registry, no guessing from the block shapes.
 */
import type { z } from "zod";
import { BLOCK_SCHEMAS, TEACHING_BLOCK_REGISTRY, TEACHING_BLOCK_REGISTRY_VERSION, validateBlock } from "./registry";
import { BLOCK_SCHEMAS_1_2, TEACHING_BLOCK_REGISTRY_1_2, TEACHING_BLOCK_REGISTRY_VERSION_1_2, validateBlock_1_2, validateBlockReferences_1_2, type VisualBlock_1_2 } from "./registry-1.2";
import { BLOCK_SCHEMAS_1_3, TEACHING_BLOCK_REGISTRY_1_3, TEACHING_BLOCK_REGISTRY_VERSION_1_3, validateBlock_1_3, validateBlockReferences_1_3, type VisualBlock_1_3 } from "./registry-1.3";

export const KNOWN_REGISTRY_VERSIONS = [TEACHING_BLOCK_REGISTRY_VERSION, TEACHING_BLOCK_REGISTRY_VERSION_1_2, TEACHING_BLOCK_REGISTRY_VERSION_1_3] as const;
export type RegistryVersion = (typeof KNOWN_REGISTRY_VERSIONS)[number];
export const isKnownRegistryVersion = (v: unknown): v is RegistryVersion => typeof v === "string" && (KNOWN_REGISTRY_VERSIONS as readonly string[]).includes(v);

type Context = Readonly<{ subject: string; grade: number }>;

/** Schemas and entries for one sealed version. Unknown versions throw `teaching_block_registry_unknown:<v>`. */
export function registryForVersion(version: string) {
  switch (version) {
    case TEACHING_BLOCK_REGISTRY_VERSION: return { version, schemas: BLOCK_SCHEMAS as Readonly<Record<string, z.ZodType>>, entries: TEACHING_BLOCK_REGISTRY };
    case TEACHING_BLOCK_REGISTRY_VERSION_1_2: return { version, schemas: BLOCK_SCHEMAS_1_2 as Readonly<Record<string, z.ZodType>>, entries: TEACHING_BLOCK_REGISTRY_1_2 };
    case TEACHING_BLOCK_REGISTRY_VERSION_1_3: return { version, schemas: BLOCK_SCHEMAS_1_3 as Readonly<Record<string, z.ZodType>>, entries: TEACHING_BLOCK_REGISTRY_1_3 };
    default: throw Error(`teaching_block_registry_unknown:${version}`);
  }
}

/**
 * Every problem for a package's blocks under its sealed registry: per-block schema, semantics and subject/grade fit,
 * then (1.2.0 and later) the same-package references. Empty means every block may be rendered.
 * 1.1.0 has no cross-block references, so only its per-block validator runs, exactly as the scene contract does today.
 */
export function validatePackageBlocks(version: unknown, blocks: readonly unknown[], context?: Context): string[] {
  if (!isKnownRegistryVersion(version)) return [`teaching_block_registry_unknown:${typeof version === "string" ? version : "missing"}`];
  if (version === TEACHING_BLOCK_REGISTRY_VERSION) return blocks.flatMap((b) => validateBlock(b, context).problems);
  const validate = version === TEACHING_BLOCK_REGISTRY_VERSION_1_2 ? validateBlock_1_2 : validateBlock_1_3;
  const results = blocks.map((b) => validate(b, context));
  const problems = results.flatMap((r) => r.problems);
  if (results.some((r) => !r.block)) return problems;
  const parsed = results.map((r) => r.block!);
  return [...problems, ...(version === TEACHING_BLOCK_REGISTRY_VERSION_1_2
    ? validateBlockReferences_1_2(parsed as VisualBlock_1_2[]) : validateBlockReferences_1_3(parsed as VisualBlock_1_3[]))];
}
