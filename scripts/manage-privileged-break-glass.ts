import { prisma } from "../lib/db";
import { logAuditRequired } from "../lib/audit";
import { isPrivilegedAccount } from "../lib/auth/privilegedIdentity";

const CONFIRMATION = "AUTHORIZE_TIME_LIMITED_PRIVILEGED_BREAK_GLASS";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const action = process.argv[2];
  const targetUserId = arg("target-user-id")?.trim();
  const actorUserId = arg("actor-user-id")?.trim();
  const approvedBy = arg("approved-by")?.trim();
  const reason = arg("reason")?.trim();
  const minutes = Number.parseInt(arg("minutes") ?? "15", 10);

  if (process.env.BREAK_GLASS_CONFIRM?.trim() !== CONFIRMATION) {
    throw new Error(`Set BREAK_GLASS_CONFIRM=${CONFIRMATION} for this invocation`);
  }
  if (!targetUserId || !actorUserId || !approvedBy || !reason || reason.length < 12) {
    throw new Error(
      "Required: --target-user-id, --actor-user-id, --approved-by, and --reason with at least 12 characters"
    );
  }
  if (actorUserId === targetUserId || approvedBy === actorUserId) {
    throw new Error("The actor, target, and second approver must identify separate responsibilities");
  }
  if (action !== "grant" && action !== "revoke") {
    throw new Error("First argument must be grant or revoke");
  }
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 30) {
    throw new Error("--minutes must be an integer between 5 and 30");
  }

  const [target, actor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isPlatformAdmin: true, schoolId: true },
    }),
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true, isPlatformAdmin: true },
    }),
  ]);
  if (!target || !isPrivilegedAccount(target)) throw new Error("Target must be a privileged user");
  if (!actor || !actor.isPlatformAdmin) throw new Error("Actor must be a platform admin");

  const now = new Date();
  const breakGlassUntil = action === "grant" ? new Date(now.getTime() + minutes * 60_000) : null;
  await prisma.$transaction(async (tx) => {
    const identity = await tx.privilegedIdentity.upsert({
      where: { userId: target.id },
      create: {
        userId: target.id,
        provider: "auth0",
        securityVersion: 1,
        breakGlassUntil,
        breakGlassReason: action === "grant" ? reason : null,
      },
      update: {
        securityVersion: { increment: 1 },
        breakGlassUntil,
        breakGlassReason: action === "grant" ? reason : null,
      },
    });
    await tx.privilegedSessionAssurance.updateMany({
      where: { identityId: identity.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await logAuditRequired(
      {
        userId: actor.id,
        action: `auth.privileged_break_glass.${action}`,
        resourceType: "privileged_identity",
        resourceId: identity.id,
        schoolId: target.schoolId,
        details: {
          targetUserId: target.id,
          approvedBy,
          reason,
          expiresAt: breakGlassUntil?.toISOString() ?? null,
          securityVersion: identity.securityVersion,
        },
      },
      tx
    );
  });

  console.log(
    JSON.stringify({
      ok: true,
      action,
      targetUserId: target.id,
      breakGlassUntil: breakGlassUntil?.toISOString() ?? null,
    })
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
