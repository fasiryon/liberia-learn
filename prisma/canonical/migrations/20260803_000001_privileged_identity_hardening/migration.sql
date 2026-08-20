-- P1-C: managed privileged MFA state and server-side session assurance.
-- MFA secrets and recovery codes are intentionally retained by Auth0.

CREATE TABLE "PrivilegedIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'auth0',
    "providerSubject" TEXT,
    "securityVersion" INTEGER NOT NULL DEFAULT 1,
    "mfaEnrolledAt" TIMESTAMP(3),
    "mfaChangedAt" TIMESTAMP(3),
    "lastMfaAt" TIMESTAMP(3),
    "recoveryResetAt" TIMESTAMP(3),
    "breakGlassUntil" TIMESTAMP(3),
    "breakGlassReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegedIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivilegedSessionAssurance" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assuranceMethod" TEXT NOT NULL,
    "authenticatedAt" TIMESTAMP(3) NOT NULL,
    "mfaVerifiedAt" TIMESTAMP(3),
    "securityVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegedSessionAssurance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivilegedIdentity_userId_key" ON "PrivilegedIdentity"("userId");
CREATE UNIQUE INDEX "PrivilegedIdentity_providerSubject_key" ON "PrivilegedIdentity"("providerSubject");
CREATE INDEX "PrivilegedIdentity_provider_providerSubject_idx" ON "PrivilegedIdentity"("provider", "providerSubject");
CREATE INDEX "PrivilegedIdentity_breakGlassUntil_idx" ON "PrivilegedIdentity"("breakGlassUntil");
CREATE UNIQUE INDEX "PrivilegedSessionAssurance_sessionId_key" ON "PrivilegedSessionAssurance"("sessionId");
CREATE INDEX "PrivilegedSessionAssurance_identityId_revokedAt_expiresAt_idx" ON "PrivilegedSessionAssurance"("identityId", "revokedAt", "expiresAt");
CREATE INDEX "PrivilegedSessionAssurance_expiresAt_idx" ON "PrivilegedSessionAssurance"("expiresAt");

ALTER TABLE "PrivilegedIdentity"
ADD CONSTRAINT "PrivilegedIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrivilegedSessionAssurance"
ADD CONSTRAINT "PrivilegedSessionAssurance_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "PrivilegedIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
