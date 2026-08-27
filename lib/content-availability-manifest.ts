export type ManifestContentEntry = {
  contentId: string;
  version: string;
  sha256: string;
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
  // P5-A policy fields are optional in the TypeScript shape only because old
  // signed manifests predate them. New issuers must provide all three.
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

export const OFFLINE_MANIFEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_CLIENT_VERSION = "1.0.0";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function isSupportedClientVersion(value: unknown): value is string {
  return typeof value === "string" && SEMVER_PATTERN.test(value);
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Manifest content cannot contain non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  throw new Error(`Manifest content cannot contain ${typeof value}`);
}

function canonicalContents(contents: ManifestContentEntry[]): ManifestContentEntry[] {
  return [...contents].sort((left, right) =>
    compareStrings(left.contentId, right.contentId) ||
    compareStrings(left.version, right.version) ||
    compareStrings(left.sha256, right.sha256),
  );
}

/** Canonical bytes covered by the RSA signature. Contents order is semantic-free. */
export function serializeContentAvailability(payload: ContentAvailabilityPayload): string {
  return JSON.stringify({
    contentId: payload.contentId,
    version: payload.version,
    revoked: payload.revoked,
    issuedAt: payload.issuedAt,
    ...(payload.sequence !== undefined
      ? {
          sequence: {
            revision: payload.sequence.revision,
            governance: payload.sequence.governance,
          },
        }
      : {}),
    ...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
    ...(payload.minClientVersion !== undefined ? { minClientVersion: payload.minClientVersion } : {}),
    ...(payload.contents !== undefined ? { contents: canonicalContents(payload.contents) } : {}),
  });
}

/** Canonical bytes hashed for each contents entry. */
export function serializeContentAvailabilityData(input: {
  contentId: string;
  version: string;
  metadata: unknown;
  payload: unknown;
  audio?: unknown;
}): string {
  return JSON.stringify(canonicalValue({
    contentId: input.contentId,
    version: input.version,
    metadata: input.metadata,
    payload: input.payload,
    audio: input.audio ?? null,
  }));
}

export function isLegacyContentAvailabilityManifest(
  payload: ContentAvailabilityPayload,
): boolean {
  return payload.expiresAt === undefined &&
    payload.minClientVersion === undefined &&
    payload.contents === undefined;
}

function isValidSequence(value: unknown): value is ContentAvailabilitySequence {
  if (!isRecord(value)) return false;
  const sequence = value as Partial<ContentAvailabilitySequence>;
  return (
    Number.isSafeInteger(sequence.revision) &&
    Number(sequence.revision) >= 1 &&
    Number.isSafeInteger(sequence.governance) &&
    Number(sequence.governance) >= 0
  );
}

function isValidContentEntry(value: unknown): value is ManifestContentEntry {
  if (!isRecord(value)) return false;
  return (
    Object.keys(value).length === 3 &&
    typeof value.contentId === "string" && value.contentId.trim().length > 0 &&
    typeof value.version === "string" && value.version.length > 0 &&
    typeof value.sha256 === "string" && SHA256_PATTERN.test(value.sha256)
  );
}

/** Validates both legacy structure and the complete P5-A policy envelope. */
export function validateContentAvailabilityPayload(payload: unknown): payload is ContentAvailabilityPayload {
  if (!isRecord(payload)) return false;
  const allowed = new Set([
    "contentId", "version", "revoked", "issuedAt", "sequence",
    "expiresAt", "minClientVersion", "contents",
  ]);
  if (Object.keys(payload).some((key) => !allowed.has(key))) return false;
  if (
    typeof payload.contentId !== "string" || payload.contentId.trim().length === 0 ||
    (typeof payload.version !== "string" && payload.version !== null) ||
    typeof payload.revoked !== "boolean" ||
    !isCanonicalUtcTimestamp(payload.issuedAt)
  ) return false;
  if (payload.sequence !== undefined && !isValidSequence(payload.sequence)) return false;

  if (isLegacyContentAvailabilityManifest(payload as ContentAvailabilityPayload)) return true;
  if (!isCanonicalUtcTimestamp(payload.expiresAt)) return false;
  if (Date.parse(payload.expiresAt) <= Date.parse(payload.issuedAt)) return false;
  if (!isSupportedClientVersion(payload.minClientVersion)) return false;
  if (!Array.isArray(payload.contents) || payload.contents.length > 1000) return false;
  if (payload.contents.some((entry) => !isValidContentEntry(entry))) return false;
  const ids = new Set(payload.contents.map((entry) => entry.contentId));
  if (ids.size !== payload.contents.length) return false;
  if (!payload.revoked && (payload.version === null || payload.contents.length === 0)) return false;
  if (!payload.revoked && !payload.contents.some((entry) =>
    entry.contentId === payload.contentId && entry.version === payload.version,
  )) return false;
  return true;
}

export function isManifestExpired(
  manifest: SignedContentAvailabilityManifest,
  nowMs = Date.now(),
): boolean {
  return !isLegacyContentAvailabilityManifest(manifest.payload) &&
    Date.parse(manifest.payload.expiresAt as string) <= nowMs;
}

export function isManifestCompatibleWithClient(
  manifest: SignedContentAvailabilityManifest,
  clientVersion: string | undefined =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_LIBERIALEARN_CLIENT_VERSION : undefined) ??
    DEFAULT_CLIENT_VERSION,
): boolean {
  if (!validateContentAvailabilityPayload(manifest.payload)) return false;
  if (isLegacyContentAvailabilityManifest(manifest.payload) || manifest.payload.revoked) return true;
  if (!isSupportedClientVersion(clientVersion)) return false;
  return compareVersions(clientVersion, manifest.payload.minClientVersion as string) >= 0;
}

/** Policy gate used before a manifest changes local trust or serves content. */
export function acceptsManifestPolicy(
  manifest: SignedContentAvailabilityManifest,
  nowMs = Date.now(),
  clientVersion?: string,
): boolean {
  if (!validateContentAvailabilityPayload(manifest.payload)) return false;
  if (isLegacyContentAvailabilityManifest(manifest.payload)) return true;
  // A revocation is authoritative even if its retention window or client
  // compatibility window has elapsed.
  if (manifest.payload.revoked) return true;
  return !isManifestExpired(manifest, nowMs) &&
    isManifestCompatibleWithClient(manifest, clientVersion);
}

export async function hashContentAvailabilityData(input: {
  contentId: string;
  version: string;
  metadata: unknown;
  payload: unknown;
  audio?: unknown;
}): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializeContentAvailabilityData(input)),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function acceptsContentAvailabilityManifest(
  candidate: SignedContentAvailabilityManifest,
  trusted?: SignedContentAvailabilityManifest | null,
): boolean {
  if (!validateContentAvailabilityPayload(candidate.payload)) {
    return false;
  }
  if (!trusted) return true;
  if (!validateContentAvailabilityPayload(trusted.payload)) return false;

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

type PublicKeyRegistryResolution =
  | { mode: "legacy" }
  | { mode: "invalid" }
  | { mode: "registry"; keys: Record<string, string> };

/**
 * Phase C registry. An absent registry preserves the original single-key
 * behavior. Once configured, only explicit registry entries are trusted, so
 * removing a retired key cannot fall back to the legacy public-key variable.
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
    if (!isRecord(entry) || Object.keys(entry).length !== 2) return { mode: "invalid" };
    if (typeof entry.keyId !== "string" || typeof entry.publicKeyPem !== "string") return { mode: "invalid" };
    const keyId = entry.keyId.trim();
    const publicKeyPem = entry.publicKeyPem.trim().replace(/\\n/g, "\n");
    if (!keyId || !publicKeyPem || Object.prototype.hasOwnProperty.call(keys, keyId)) {
      return { mode: "invalid" };
    }
    keys[keyId] = publicKeyPem;
  }
  return { mode: "registry", keys };
}

function resolvePublicKeyForManifest(manifest: SignedContentAvailabilityManifest): string | null {
  const registry = resolvePublicKeyRegistry();
  if (registry.mode === "legacy") return publicKeyFromEnvironment();
  if (registry.mode === "invalid" || !manifest?.keyId) return null;
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
  if (!validateContentAvailabilityPayload(manifest.payload)) return false;
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
