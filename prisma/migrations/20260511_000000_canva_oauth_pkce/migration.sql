-- Store encrypted Canva OAuth credentials for PKCE-based Connect auth.

CREATE TABLE IF NOT EXISTS "CanvaOAuthCredential" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'canva',
  "encryptedTokenSet" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "tokenType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CanvaOAuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanvaOAuthCredential_provider_key"
  ON "CanvaOAuthCredential"("provider");

