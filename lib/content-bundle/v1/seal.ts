/**
 * Validate-then-hash. An invalid bundle never receives a content identity, and the sealed bundle
 * carries its hash in `identity.contentHash`.
 */
import { hashContentBundle } from "./hash";
import { validateContentBundle, type ContentBundleValidationOptions } from "./validator";
import type { ContentBundleV1, ContentBundleValidationError } from "./types";

export type SealedContentBundle = Readonly<{ bundle: ContentBundleV1; contentHash: string }>;

export function sealContentBundle(
  input: unknown,
  options?: ContentBundleValidationOptions,
): Readonly<{ ok: true; sealed: SealedContentBundle; errors: readonly ContentBundleValidationError[] }> | Readonly<{ ok: false; sealed: null; errors: readonly ContentBundleValidationError[] }> {
  const result = validateContentBundle(input, options);
  if (result.ok === false) return { ok: false, sealed: null, errors: result.errors };
  const contentHash = hashContentBundle(result.bundle);
  return { ok: true, sealed: { bundle: { ...result.bundle, identity: { ...result.bundle.identity, contentHash } }, contentHash }, errors: [] };
}
