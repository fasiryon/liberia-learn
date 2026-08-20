-- PROPOSAL ONLY. This file is outside the active migration root and must not be deployed.
-- Founder/advisor review and separate authorization are required before activation.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_SUPER_ADMIN' AFTER 'MOE_OFFICIAL';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_DISTRICT_ADMIN' AFTER 'MOE_SUPER_ADMIN';
