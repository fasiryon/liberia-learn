import { createSign } from "crypto";
import {
  serializeContentAvailability,
  type ContentAvailabilitySequence,
  type ContentAvailabilityPayload,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

function privateKeyFromEnvironment(): string | null {
  const value = process.env.CONTENT_MANIFEST_PRIVATE_KEY?.trim();
  return value ? value.replace(/\\n/g, "\n") : null;
}

export function signContentAvailability(
  input: Omit<ContentAvailabilityPayload, "issuedAt" | "sequence"> & {
    issuedAt: string;
    sequence: ContentAvailabilitySequence;
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
    input.sequence.governance < 0
  ) return null;

  const payload: ContentAvailabilityPayload = {
    contentId: input.contentId,
    version: input.version,
    revoked: input.revoked,
    issuedAt: input.issuedAt,
    sequence: input.sequence,
  };
  const signer = createSign("RSA-SHA256");
  signer.update(serializeContentAvailability(payload));
  signer.end();
  return {
    payload,
    signature: signer.sign(privateKey, "base64"),
    keyId,
  };
}
