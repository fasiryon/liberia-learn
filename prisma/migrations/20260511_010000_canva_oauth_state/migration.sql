-- Store short-lived Canva OAuth PKCE state server-side so callback verification
-- does not depend on browser cookie preservation across Canva redirects.

CREATE TABLE IF NOT EXISTS "CanvaOAuthState" (
  "id" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CanvaOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanvaOAuthState_state_key"
  ON "CanvaOAuthState"("state");

CREATE INDEX IF NOT EXISTS "CanvaOAuthState_expiresAt_idx"
  ON "CanvaOAuthState"("expiresAt");
