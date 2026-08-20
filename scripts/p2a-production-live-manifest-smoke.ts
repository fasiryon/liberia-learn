import { encode } from "next-auth/jwt";
import { prisma } from "../lib/db";
import {
  verifyContentAvailabilityManifest,
  type SignedContentAvailabilityManifest,
} from "../lib/content-availability-manifest";

const PRODUCTION_PROJECT_REF = "bnphuinpvgpmebcsvmsp";
const STAGING_PROJECT_REF = "yonpfzjczoffhrgibxkz";

function assertProduction(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (process.env.P2A_PRODUCTION_PROJECT_REF !== PRODUCTION_PROJECT_REF) {
    throw new Error("P2-A live manifest STOP: explicit production project identity mismatch");
  }
  if (!databaseUrl.includes(PRODUCTION_PROJECT_REF) || databaseUrl.includes(STAGING_PROJECT_REF)) {
    throw new Error("P2-A live manifest STOP: database URL is not positively production");
  }
}

async function main() {
  assertProduction();
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  const publicKey = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY
    ?.trim()
    .replace(/\\n/g, "\n");
  if (!secret || !publicKey) {
    throw new Error("P2-A live manifest STOP: required verification configuration is missing");
  }
  const fixture = await prisma.curriculumContent.findFirstOrThrow({
    where: {
      contentId: { startsWith: "p2a-production-smoke-", endsWith: "-deterministic" },
      payload: { path: ["p2aProductionFixture"], equals: true },
      provenance: { lifecycleState: "REVOKED" },
    },
    orderBy: { createdAt: "desc" },
    select: { contentId: true },
  });
  const principal = await prisma.user.findFirstOrThrow({
    where: {
      role: "STUDENT",
      isPlatformAdmin: false,
      school: { status: "ACTIVE" },
    },
    select: { id: true, role: true, schoolId: true },
  });
  const token = await encode({
    secret,
    maxAge: 5 * 60,
    token: {
      sub: principal.id,
      id: principal.id,
      role: principal.role,
      schoolId: principal.schoolId,
      isPlatformAdmin: false,
      mustChangePIN: false,
      iat: Math.floor(Date.now() / 1000),
    },
  });
  const baseUrl = (process.env.P2A_PRODUCTION_BASE_URL ?? "https://liberia-learn.vercel.app")
    .replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/curriculum/${fixture.contentId}`, {
    headers: {
      cookie: `__Secure-next-auth.session-token=${token}; next-auth.session-token=${token}`,
    },
    redirect: "manual",
  });
  const body = await response.json() as {
    error?: string;
    offlineManifest?: SignedContentAvailabilityManifest | null;
    revocation?: {
      futureAssignmentPolicy?: string | null;
      existingAssignmentPolicy?: string | null;
      offlineCachePolicy?: string | null;
      replacementRevisionId?: string | null;
    } | null;
  };
  const signatureValid = body.offlineManifest
    ? await verifyContentAvailabilityManifest(body.offlineManifest, publicKey)
    : false;
  const checks = {
    revokedResponse: response.status === 410 && body.error === "Content revoked",
    signedManifestPresent: Boolean(body.offlineManifest?.signature && body.offlineManifest.keyId),
    manifestTargetsFixture:
      body.offlineManifest?.payload.contentId === fixture.contentId &&
      body.offlineManifest.payload.revoked === true &&
      body.offlineManifest.payload.version === null,
    signatureValid,
    replacementPolicy:
      body.revocation?.futureAssignmentPolicy === "REPLACE_WITH_SUCCESSOR" &&
      body.revocation.existingAssignmentPolicy === "REPLACE_WITH_SUCCESSOR" &&
      body.revocation.offlineCachePolicy === "URGENT_INVALIDATE_ON_NEXT_REFRESH" &&
      Boolean(body.revocation.replacementRevisionId),
  };
  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(`P2-A live manifest STOP: ${JSON.stringify({ status: response.status, checks })}`);
  }
  console.log(JSON.stringify({ contentId: fixture.contentId, status: response.status, checks }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
