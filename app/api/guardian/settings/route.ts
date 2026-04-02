import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  isGuardianSmsOptedIn,
  readGuardianSmsPreferences,
} from "@/lib/guardian/smsPreferences";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("GUARDIAN");
    const guardian = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        guardianPhoneE164: true,
        preferredChannel: true,
        smsOptIn: true,
        guardianSmsPreferences: true,
      },
    });

    const preferences = readGuardianSmsPreferences(
      guardian?.guardianSmsPreferences,
      guardian?.smsOptIn ?? true
    );

    return NextResponse.json({
      phoneNumber: guardian?.guardianPhoneE164 ?? "",
      updatePhoneHref: "/guardian/settings/phone",
      preferredChannel: guardian?.preferredChannel ?? "SMS",
      preferences,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load guardian settings" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireRole("GUARDIAN");
    const body = await req.json().catch(() => null);
    const preferences = readGuardianSmsPreferences(body);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredChannel: isGuardianSmsOptedIn(preferences) ? "SMS" : "EMAIL",
        smsOptIn: isGuardianSmsOptedIn(preferences),
        guardianSmsPreferences: preferences,
      },
    });

    void logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "guardian.settings.updated",
      resourceType: "guardian_settings",
      resourceId: user.id,
      details: preferences,
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update guardian settings" },
      { status: err?.status ?? 500 }
    );
  }
}
