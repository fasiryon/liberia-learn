-- Sprint 18: Add adminCode field to PasswordResetToken for no-email student recovery
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "adminCode" TEXT;
