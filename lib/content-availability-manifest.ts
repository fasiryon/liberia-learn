export type ManifestContentEntry = {
  contentId: string;
  version: string | null;
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
  sequence?: number;
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
    ...(payload.sequence !== undefined ? { sequence: payload.sequence } : {}),
  });
}

function publicKeyFromEnvironment(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY?.trim();
  return value ? value.replace(/\\n/g, "\n") : null;
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
 * @param previousSequence The `sequence` of a manifest for the same contentId
 * that the caller already trusts more recently than this one (e.g. the
 * manifest currently cached on-device), if any. When provided and the
 * candidate manifest's own `sequence` is a lower number, verification fails —
 * this rejects a captured, still-validly-signed older manifest being replayed
 * to roll a device back to a previously-superseded (e.g. pre-revocation)
 * trust state. Omit when there is nothing to compare against (e.g. first-time
 * caching, or a manifest that predates this field on either side) — the
 * check is opt-in per call site, not a global behavior change.
 */
export async function verifyContentAvailabilityManifest(
  manifest: SignedContentAvailabilityManifest,
  publicKeyPem: string | null = publicKeyFromEnvironment(),
  previousSequence?: number
): Promise<boolean> {
  if (!publicKeyPem || !globalThis.crypto?.subtle) return false;
  if (!manifest?.payload?.contentId || !manifest.signature || !manifest.keyId) return false;
  if (previousSequence !== undefined) {
    // A defined trust baseline must never be overridden by an undated
    // manifest (one that predates this field) or by a strictly older one —
    // both are treated as a rollback/replay attempt.
    if (typeof manifest.payload.sequence !== "number" || manifest.payload.sequence < previousSequence) {
      return false;
    }
  }

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
