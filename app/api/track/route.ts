// app/api/track/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  eventType: z.string().min(1).max(80),
  sessionId: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;

    const body = await req.json();
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: true }); // analytics must never break UX
    }

    const { eventType, sessionId, contentId, metadata } = parsed.data;

    await prisma.auditLog.create({
      data: {
        userId,
        action: eventType,
        details: {
          sessionId: sessionId ?? null,
          contentId: contentId ?? null,
          userAgent: req.headers.get("user-agent") ?? null,
          ...(metadata ?? {}),
        },
      },
    });
  } catch (_) {
    // analytics must never break the user experience
  }

  return NextResponse.json({ ok: true });
}

