/**
 * GET /api/health
 *
 * Public health check endpoint — no auth required.
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
 *   200 — healthy or degraded (load balancer keeps serving)
 *   503 — unhealthy (database unreachable; take out of rotation)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    const pending = Number(rows[0]?.pending ?? 0n);
    return pending > 0 ? "pending" : "ok";
  } catch {
    return "error";
  }
}

function checkAiFactory(): "ok" | "unavailable" {
  return process.env.OPENAI_API_KEY ? "ok" : "unavailable";
}

function checkSms(): "ok" | "unavailable" {
  return process.env.AT_API_KEY ? "ok" : "unavailable";
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
