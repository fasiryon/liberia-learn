import { prisma } from "../lib/db";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";
import { enforceLegacyReviewAdapter } from "../lib/curriculum/review/legacyAdapter";

const STAGING_REF = "yonpfzjczoffhrgibxkz";

async function main(): Promise<void> {
  const target = parseSupabaseDatabaseTarget(process.env.DATABASE_URL ?? "", "DATABASE_URL");
  if (target.projectRef !== STAGING_REF) throw new Error("P2-B shadow parity refuses non-staging database");
  process.env.P2B_REVIEW_OPERATIONS_ENABLED = "false";
  process.env.P2B_REVIEW_SHADOW_ENABLED = "true";
  const actor = await prisma.user.findFirst({ where: { role: "ADMIN", isPlatformAdmin: true } });
  const content = await prisma.curriculumContent.findFirst({
    where: { provenance: { currentRevisionId: { not: null } } },
    include: { provenance: true },
    orderBy: { createdAt: "asc" },
  });
  if (!actor || !content?.provenance?.currentRevisionId) throw new Error("Staging shadow fixture is unavailable");
  const idempotencyKey = `p2b-shadow-parity-${Date.now()}`;
  await enforceLegacyReviewAdapter({ contentId: content.contentId, user: actor, requestedAction: "SHADOW_PARITY_ONLY", idempotencyKey });
  const audit = await prisma.auditLog.findFirst({
    where: { userId: actor.id, action: "p2b.shadow.legacy_decision", resourceId: content.contentId },
    orderBy: { createdAt: "desc" },
  });
  if (!audit) throw new Error("Shadow parity audit was not recorded");
  const details = audit.details as Record<string, unknown>;
  console.log(JSON.stringify({
    mode: "SHADOW_ONLY_LEGACY_REMAINS_AUTHORITY",
    contentId: content.contentId,
    revisionId: details.revisionId,
    legacyAuthority: details.legacyAuthority,
    p2bRequiredAuthority: details.p2bRequiredAuthority,
    p2bRequiredReviewCount: details.p2bRequiredReviewCount,
    p2bApprovalBlocked: details.p2bApprovalBlocked,
    mismatchDisposition: "Legacy role ceiling is not a qualification. P2-B correctly requires roster and credential before cutover.",
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
