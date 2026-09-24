// route-policy: auth=public; scope=none; authority=liveness-probe; rationale=unauthenticated readiness probe that returns no driver error text outside development
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function redact(url: string | undefined): Record<string, string> {
  if (!url) return { error: "DATABASE_URL is not set" };
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: u.username,
      database: u.pathname.replace("/", ""),
      params: u.search,
    };
  } catch {
    return { error: "DATABASE_URL is not a valid URL" };
  }
}

export async function GET() {
  const conn = redact(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === "development") {
    logger.info("[health/db] connection info", { conn });
  }

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const latencyMs = Date.now() - start;
    const response: Record<string, unknown> = { ok: true, latencyMs, ts: new Date().toISOString() };
    if (process.env.NODE_ENV === "development") {
      response.conn = conn;
    }
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[health/db] query failed", { errorMessage: message });
    // Public, unauthenticated endpoint: driver errors can name the database
    // host, so the raw message stays in the server log outside development.
    const errResponse: Record<string, unknown> = { ok: false, error: "database_unreachable", ts: new Date().toISOString() };
    if (process.env.NODE_ENV === "development") {
      errResponse.error = message;
      errResponse.conn = conn;
    }
    return NextResponse.json(errResponse, { status: 503 });
  }
}
