export type ContentAvailabilityPayload = {
  contentId: string;
  version: string | null;
  revoked: boolean;
  issuedAt: string;
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

export async function verifyContentAvailabilityManifest(
  manifest: SignedContentAvailabilityManifest,
  publicKeyPem: string | null = publicKeyFromEnvironment()
): Promise<boolean> {
  if (!publicKeyPem || !globalThis.crypto?.subtle) return false;
  if (!manifest?.payload?.contentId || !manifest.signature || !manifest.keyId) return false;

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
