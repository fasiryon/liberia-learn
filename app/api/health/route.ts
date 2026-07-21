/**
 * GET /api/health
 *
 * Public health check endpoint - no auth required.
 * Used by load balancers, uptime monitors, and the deploy verification step.
 *
 * Response shape:
 * {
 *   status: "healthy" | "degraded" | "unhealthy",
 *   version: "1.0.0",
 *   timestamp: ISO string,
 *   checks: {
 *     database:   "ok" | "error",
 *     migrations: "ok" | "pending" | "error",
 *     aiFactory:  "ok" | "unavailable",
 *     sms:        "ok" | "unavailable",
 *   }
 * }
 *
 * HTTP status:
 *   200 - healthy or degraded (load balancer keeps serving)
 *   503 - unhealthy (database unreachable; take out of rotation)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isLiveSmsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const VERSION = "1.0.0";

async function checkDatabase(): Promise<"ok" | "error"> {
  try {
    await prisma.school.count();
    return "ok";
  } catch {
    return "error";
  }
}

async function checkMigrations(): Promise<"ok" | "pending" | "error"> {
  try {
    const rows = await prisma.$queryRaw<Array<{ pending: bigint }>>`
      SELECT COUNT(*) AS pending
      FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `;
    const rawPending = rows?.[0]?.pending;
    const pending =
      rawPending === null || rawPending === undefined
        ? 0
        : typeof rawPending === "bigint"
          ? Number(rawPending)
          : typeof rawPending === "number"
            ? rawPending
            : Number.parseInt(String(rawPending), 10) || 0;
    return pending > 0 ? "pending" : "ok";
  } catch {
    return "error";
  }
}

function checkAiFactory(): "ok" | "unavailable" {
  return process.env.OPENAI_API_KEY ? "ok" : "unavailable";
}

function hasTwilioConfig(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_PHONE_NUMBER?.trim()
  );
}

function hasAfricasTalkingConfig(): boolean {
  return Boolean(
    (process.env.AT_API_KEY ?? process.env.AFRICA_TALKING_API_KEY)?.trim() &&
      (process.env.AT_USERNAME ?? process.env.AFRICA_TALKING_USERNAME)?.trim()
  );
}

function hasOrangeConfig(): boolean {
  return Boolean(
    process.env.ORANGE_CLIENT_ID?.trim() &&
      process.env.ORANGE_CLIENT_SECRET?.trim() &&
      process.env.ORANGE_SENDER_NUMBER?.trim()
  );
}

function checkSms(): "ok" | "unavailable" {
  if (!isLiveSmsEnabled()) return "ok";

  const explicitProvider = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicitProvider === "orange") return hasOrangeConfig() ? "ok" : "unavailable";
  if (explicitProvider === "twilio") return hasTwilioConfig() ? "ok" : "unavailable";
  if (explicitProvider === "africastalking" || explicitProvider === "africa's talking") {
    return hasAfricasTalkingConfig() ? "ok" : "unavailable";
  }

  return hasAfricasTalkingConfig() || hasTwilioConfig() ? "ok" : "unavailable";
}

export async function GET() {
  const [database, migrations] = await Promise.all([
    checkDatabase(),
    checkMigrations(),
  ]);

  const aiFactory = checkAiFactory();
  const sms = checkSms();

  const checks = { database, migrations, aiFactory, sms };

  let status: "healthy" | "degraded" | "unhealthy";
  if (database === "error") {
    status = "unhealthy";
  } else if (
    migrations === "pending" ||
    aiFactory === "unavailable" ||
    sms === "unavailable"
  ) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  return NextResponse.json(
    { status, version: VERSION, timestamp: new Date().toISOString(), checks },
    { status: database === "error" ? 503 : 200 }
  );
}
