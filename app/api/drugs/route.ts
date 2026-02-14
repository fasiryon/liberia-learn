import { NextResponse } from "next/server";

/**
 * Build-safe route.
 * Next build may execute API routes during "Collecting page data".
 * If Supabase env vars are missing, DO NOT throw — return a controlled response.
 */

function envOk() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET() {
  if (!envOk()) {
    return NextResponse.json(
      {
        ok: false,
        disabled: true,
        error:
          "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. /api/drugs is disabled for this deployment.",
      },
      { status: 501 }
    );
  }

  // If you want this endpoint active, restore the real implementation here.
  // Keeping it minimal to stop builds from failing.
  return NextResponse.json({ ok: true, message: "Supabase env vars present." });
}

export async function POST() {
  if (!envOk()) {
    return NextResponse.json(
      {
        ok: false,
        disabled: true,
        error:
          "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. /api/drugs is disabled for this deployment.",
      },
      { status: 501 }
    );
  }

  return NextResponse.json({ ok: true, message: "Supabase env vars present." });
}
