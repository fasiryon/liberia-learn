export type ManifestContentEntry = {
  contentId: string;
  version: string | null;
};

/** Durable P2-A ordering cursor for one CurriculumProvenance stream. */
export type ContentAvailabilitySequence = {
  revision: number;
  governance: number;
};

export type ContentAvailabilityPayload = {
  contentId: string;
  version: string | null;
  revoked: boolean;
  issuedAt: string;
  // P5-A envelope fields. `sequence` is wired (Phase B: signed, verified,
  // and used for rollback/replay rejection — see verifyContentAvailabilityManifest).
  // expiresAt/minClientVersion/contents remain contract/shape only: not yet
  // populated by signContentAvailability, not yet included in
  // serializeContentAvailability's signed bytes, and not yet checked by
  // verifyContentAvailabilityManifest — deferred to later, separately-reviewed
  // P5-A phases. A manifest carrying those three today would have them
  // silently dropped at signing time, not signed or verified.
  sequence?: ContentAvailabilitySequence;
  expiresAt?: string | null;
  minClientVersion?: string | null;
  contents?: ManifestContentEntry[];
};

export type SignedContentAvailabilityManifest = {
  payload: ContentAvailabilityPayload;
  signature: string;
  keyId: string;
};

export function serializeContentAvailability(payload: ContentAvailabilityPayload): string {
  return JSON.stringify({
    contentId: payload.contentId,
    version: payload.version,
    revoked: payload.revoked,
    issuedAt: payload.issuedAt,
    // Included so a rollback/replay cannot strip or lower `sequence` without
    // invalidating the signature. Omitted from the signed bytes entirely
    // (not signed as null) when absent, so a pre-Phase-B manifest that never
    // carried a sequence still serializes identically to before.
    ...(payload.sequence !== undefined
      ? {
          sequence: {
            revision: payload.sequence.revision,
            governance: payload.sequence.governance,
          },
        }
      : {}),
  });
}

function isValidSequence(value: unknown): value is ContentAvailabilitySequence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sequence = value as Partial<ContentAvailabilitySequence>;
  return (
    Number.isSafeInteger(sequence.revision) &&
    Number(sequence.revision) >= 1 &&
    Number.isSafeInteger(sequence.governance) &&
    Number(sequence.governance) >= 0
  );
}

export function acceptsContentAvailabilityManifest(
  candidate: SignedContentAvailabilityManifest,
  trusted?: SignedContentAvailabilityManifest | null,
): boolean {
  if (candidate.payload.sequence !== undefined && !isValidSequence(candidate.payload.sequence)) {
    return false;
  }
  if (!trusted) return true;

  const previous = trusted.payload.sequence;
  const incoming = candidate.payload.sequence;
  if (previous === undefined) {
    if (incoming !== undefined) return isValidSequence(incoming);
    return (
      serializeContentAvailability(candidate.payload) ===
      serializeContentAvailability(trusted.payload)
    );
  }
  if (!isValidSequence(previous) || !isValidSequence(incoming)) return false;

  if (incoming.revision < previous.revision) return false;
  if (incoming.revision > previous.revision) return true;
  if (incoming.governance < previous.governance) return false;

  const sameSequence =
    incoming.governance === previous.governance;
  if (!sameSequence) return true;

  return (
    serializeContentAvailability(candidate.payload) ===
    serializeContentAvailability(trusted.payload)
  );
}

function publicKeyFromEnvironment(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY?.trim();
  return value ? value.replace(/\\n/g, "\n") : null;
}

type PublicKeyRegistryEntry = { keyId: string; publicKeyPem: string };

type PublicKeyRegistryResolution =
  | { mode: "legacy" }
  | { mode: "invalid" }
  | { mode: "registry"; keys: Record<string, string> };

/**
 * P5-A Phase C: NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS, a JSON array of
 * {keyId, publicKeyPem} (must be NEXT_PUBLIC_ since verification runs
 * client-side, offline, with no server round-trip). Deliberately minimal —
 * no key metadata, no expiry, no automatic rotation ceremony.
 *
 * Three states are kept explicit rather than merged into one fallback chain:
 *  - unset/blank -> "legacy": every existing single-key deployment (this var
 *    never configured) is unaffected — manifest.keyId is not consulted at
 *    all, exactly as before this registry existed.
 *  - set but malformed (bad JSON, wrong shape, blank id/pem, duplicate
 *    keyId) -> "invalid": fails closed for every manifest instead of
 *    silently reverting to the single-key var, which would otherwise mask a
 *    typo'd rotation as "verification still works".
 *  - set and well-formed -> "registry": manifest.keyId is looked up
 *    explicitly; an id absent from the registry fails closed and never
 *    falls through to the legacy single-key var — that fallback is exactly
 *    what would stop key retirement from actually retiring a key.
 */
function resolvePublicKeyRegistry(): PublicKeyRegistryResolution {
  const raw = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS?.trim();
  if (!raw) return { mode: "legacy" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { mode: "invalid" };
  }
  if (!Array.isArray(parsed)) return { mode: "invalid" };

  const keys: Record<string, string> = {};
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { mode: "invalid" };
    const record = entry as Record<string, unknown>;
    if (Object.keys(record).length !== 2) return { mode: "invalid" };
    if (typeof record.keyId !== "string" || typeof record.publicKeyPem !== "string") {
      return { mode: "invalid" };
    }
    const keyId = (record as PublicKeyRegistryEntry).keyId.trim();
    const publicKeyPem = (record as PublicKeyRegistryEntry).publicKeyPem.trim();
    if (!keyId || !publicKeyPem) return { mode: "invalid" };
    if (Object.prototype.hasOwnProperty.call(keys, keyId)) return { mode: "invalid" };
    keys[keyId] = publicKeyPem;
  }
  return { mode: "registry", keys };
}

/**
 * Resolves the public key to verify a manifest against.
 *
 * - Registry unconfigured: the single legacy env var governs every
 *   manifest, regardless of its keyId — identical to pre-Phase-C behavior.
 * - Registry configured: only an explicit keyId match in the registry is
 *   trusted. An unknown keyId — including one that happens to equal the
 *   legacy var's own key — fails closed. That is what makes retiring a key
 *   (removing its entry) actually retire it instead of leaving a silent
 *   back door through the legacy var.
 * - Registry malformed: nothing verifies, by design — a misconfigured
 *   rotation must not silently degrade to "verification still works".
 *
 * If the resolved key turns out to be the wrong one for this manifest's
 * actual signature, cryptographic verification itself fails closed — this
 * function only ever narrows which key is tried, it never widens what
 * counts as a valid signature. `keyId` is not part of the signed bytes
 * (see serializeContentAvailability), so tampering with it just selects the
 * wrong verification key, which the signature check below then rejects.
 */
function resolvePublicKeyForManifest(manifest: SignedContentAvailabilityManifest): string | null {
  const registry = resolvePublicKeyRegistry();
  if (registry.mode === "legacy") return publicKeyFromEnvironment();
  if (registry.mode === "invalid") return null;
  if (!manifest?.keyId) return null;
  return registry.keys[manifest.keyId] ?? null;
}

function pemBytes(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

function base64Bytes(value: string): ArrayBuffer {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

/**
 * The optional trusted manifest is the rollback baseline for the same
 * contentId. Historical unsequenced state may advance once to a sequenced
 * baseline. After that, revision order is authoritative; governance order is
 * compared only within the same revision. Unsequenced, regressing, or equal-
 * but-conflicting state fails closed.
 */
export async function verifyContentAvailabilityManifest(
  manifest: SignedContentAvailabilityManifest,
  publicKeyPem: string | null = resolvePublicKeyForManifest(manifest),
  trustedManifest?: SignedContentAvailabilityManifest | null,
): Promise<boolean> {
  if (!publicKeyPem || !globalThis.crypto?.subtle) return false;
  if (!manifest?.payload?.contentId || !manifest.signature || !manifest.keyId) return false;
  if (
    trustedManifest?.payload.contentId !== undefined &&
    trustedManifest.payload.contentId !== manifest.payload.contentId
  ) return false;
  if (!acceptsContentAvailabilityManifest(manifest, trustedManifest)) return false;

  try {
    const key = await globalThis.crypto.subtle.importKey(
      "spki",
      pemBytes(publicKeyPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await globalThis.crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64Bytes(manifest.signature),
      new TextEncoder().encode(serializeContentAvailability(manifest.payload))
    );
  } catch {
    return false;
  }
}
