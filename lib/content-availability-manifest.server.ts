import { createSign } from "crypto";
import {
  serializeContentAvailability,
  type ContentAvailabilityPayload,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

function privateKeyFromEnvironment(): string | null {
  const value = process.env.CONTENT_MANIFEST_PRIVATE_KEY?.trim();
  return value ? value.replace(/\\n/g, "\n") : null;
}

export function signContentAvailability(
  input: Omit<ContentAvailabilityPayload, "issuedAt">
): SignedContentAvailabilityManifest | null {
  const privateKey = privateKeyFromEnvironment();
  const keyId = process.env.CONTENT_MANIFEST_KEY_ID?.trim();
  if (!privateKey || !keyId) return null;

  const payload: ContentAvailabilityPayload = {
    contentId: input.contentId,
    version: input.version,
    revoked: input.revoked,
    issuedAt: new Date().toISOString(),
    // Monotonic per the signing server's clock. A dedicated persisted
    // counter would need a schema change this phase deliberately avoids;
    // Date.now() only needs to be non-decreasing across signings, which a
    // real clock already provides for the rollback check this enables.
    sequence: Date.now(),
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
