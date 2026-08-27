import { createHash, createSign } from "crypto";
import {
  OFFLINE_MANIFEST_TTL_MS,
  serializeContentAvailability,
  serializeContentAvailabilityData,
  validateContentAvailabilityPayload,
  type ContentAvailabilitySequence,
  type ManifestContentEntry,
  type ContentAvailabilityPayload,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

function privateKeyFromEnvironment(): string | null {
  const value = process.env.CONTENT_MANIFEST_PRIVATE_KEY?.trim();
  return value ? value.replace(/\\n/g, "\n") : null;
}

export function signContentAvailability(
  input: Omit<ContentAvailabilityPayload, "issuedAt" | "sequence" | "expiresAt" | "minClientVersion" | "contents"> & {
    issuedAt: string;
    sequence: ContentAvailabilitySequence;
    expiresAt: string;
    minClientVersion: string;
    contents: ManifestContentEntry[];
  },
): SignedContentAvailabilityManifest | null {
  const privateKey = privateKeyFromEnvironment();
  const keyId = process.env.CONTENT_MANIFEST_KEY_ID?.trim();
  if (
    !privateKey ||
    !keyId ||
    !input.issuedAt ||
    !input.sequence ||
    !Number.isSafeInteger(input.sequence.revision) ||
    input.sequence.revision < 1 ||
    !Number.isSafeInteger(input.sequence.governance) ||
    input.sequence.governance < 0 ||
    !input.expiresAt ||
    !input.minClientVersion ||
    !Array.isArray(input.contents)
  ) return null;

  const payload: ContentAvailabilityPayload = {
    contentId: input.contentId,
    version: input.version,
    revoked: input.revoked,
    issuedAt: input.issuedAt,
    sequence: input.sequence,
    expiresAt: input.expiresAt,
    minClientVersion: input.minClientVersion,
    contents: input.contents,
  };
  if (!validateContentAvailabilityPayload(payload)) return null;
  const signer = createSign("RSA-SHA256");
  signer.update(serializeContentAvailability(payload));
  signer.end();
  return {
    payload,
    signature: signer.sign(privateKey, "base64"),
    keyId,
  };
}

export function hashContentAvailabilityData(input: {
  contentId: string;
  version: string;
  metadata: unknown;
  payload: unknown;
  audio?: unknown;
}): string | null {
  try {
    return createHash("sha256")
      .update(serializeContentAvailabilityData(input), "utf8")
      .digest("hex");
  } catch {
    return null;
  }
}

export function buildContentAvailabilityExpiry(issuedAt: string): string | null {
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + OFFLINE_MANIFEST_TTL_MS).toISOString();
}
