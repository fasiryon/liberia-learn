-- RR-1/RR-3: token hashing + session safety
ALTER TABLE "User"
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

ALTER TABLE "InviteToken"
ADD COLUMN "tokenHash" TEXT;

CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

ALTER TABLE "PasswordResetToken"
ADD COLUMN "tokenHash" TEXT;

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
