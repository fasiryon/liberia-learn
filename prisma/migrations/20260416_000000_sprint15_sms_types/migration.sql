-- Migration: Sprint 15 — SMS notification types
-- Adds weekly_digest, assignment_due, certificate_awarded to SMSMessageType enum.
--
-- PostgreSQL enum values can be added with ALTER TYPE … ADD VALUE IF NOT EXISTS.
-- These are append-only (safe to run on live DBs) — enum shrink is not supported.

ALTER TYPE "SMSMessageType" ADD VALUE IF NOT EXISTS 'weekly_digest';
ALTER TYPE "SMSMessageType" ADD VALUE IF NOT EXISTS 'assignment_due';
ALTER TYPE "SMSMessageType" ADD VALUE IF NOT EXISTS 'certificate_awarded';
