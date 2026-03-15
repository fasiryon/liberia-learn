import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    console.log("[health/db] connection info:", JSON.stringify(conn));
  }

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const latencyMs = Date.now() - start;
    return NextResponse.json({ ok: true, latencyMs, conn, ts: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health/db] query failed:", message);
    return NextResponse.json({ ok: false, error: message, conn, ts: new Date().toISOString() }, { status: 503 });
  }
}
