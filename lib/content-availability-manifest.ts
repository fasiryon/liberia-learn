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
  publicKeyPem: string | null = publicKeyFromEnvironment(),
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
