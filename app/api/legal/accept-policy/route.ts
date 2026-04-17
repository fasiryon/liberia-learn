import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  CURRENT_POLICY_VERSION,
  DATA_POLICY_KEY,
  DATA_POLICY_SOURCE,
} from "@/lib/policy/policyVersion";

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const requestedVersion = typeof body.policyVersion === "string" ? body.policyVersion : CURRENT_POLICY_VERSION;

  if (requestedVersion !== CURRENT_POLICY_VERSION) {
    return NextResponse.json({ ok: false, error: "Unsupported policy version" }, { status: 400 });
  }

  const existing = await prisma.dataPolicyAcceptance.findFirst({
    where: {
      userId: user.id,
      policyKey: DATA_POLICY_KEY,
      policyVersion: CURRENT_POLICY_VERSION,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? null;

  await prisma.$transaction([
    prisma.dataPolicyAcceptance.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId ?? null,
        policyKey: DATA_POLICY_KEY,
        policyVersion: CURRENT_POLICY_VERSION,
        source: DATA_POLICY_SOURCE,
        locale: "en-LR",
        ipAddress,
        metadata: {
          role: user.role,
          userAgent,
        },
      },
    }),
    prisma.consentRecord.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId ?? null,
        consentType: DATA_POLICY_KEY,
        status: "granted",
        legalBasis: "user_acceptance",
        policyVersion: CURRENT_POLICY_VERSION,
        source: DATA_POLICY_SOURCE,
        metadata: {
          role: user.role,
          ipAddress,
          userAgent,
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
