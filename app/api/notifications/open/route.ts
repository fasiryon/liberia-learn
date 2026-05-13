import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const urlPath = typeof body?.urlPath === "string" && body.urlPath.startsWith("/") ? body.urlPath.slice(0, 120) : "/";

    await logProductSignal({
      schoolId: user.schoolId ?? null,
      userId: user.id,
      actor: { type: "user", id: user.id, role: user.role },
      target: { type: "push_notification", id: urlPath },
      eventType: "push.notification.opened",
      source: "/api/notifications/open",
      dedupeKey: `push.notification.opened:${user.schoolId ?? "unknown"}:${user.id}:${urlPath}:${new Date().toISOString().slice(0, 16)}`,
      metadata: { urlPath },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

