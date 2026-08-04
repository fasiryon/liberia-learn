// lib/curriculum/riskTriageNotify.ts
//
// Emails every user who holds PERMISSIONS.CURRICULUM_APPROVE (queried live via
// hasPermission/ROLE_PERMISSIONS, not a hardcoded contact list - so ADMIN,
// MOE_OFFICIAL, MOE_SUPER_ADMIN, and any future role granted the permission are
// covered automatically) plus platform admins, when riskTriage.ts flags a
// lesson for review. Best-effort: failures here must never block the
// approval/flagging decision in riskTriage.ts.
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from "@/lib/permissions";

function reviewUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";
  return `${base}/admin/ops/curriculum-review?status=NEEDS_REVIEW`;
}

export async function notifyRiskReviewers(
  contentId: string,
  riskScore: number,
  riskReasons: string[]
): Promise<void> {
  const rolesWithApprove = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
    hasPermission({ role }, PERMISSIONS.CURRICULUM_APPROVE)
  );

  const recipients = await prisma.user.findMany({
    where: {
      OR: [{ role: { in: rolesWithApprove } }, { isPlatformAdmin: true }],
    },
    select: { email: true },
  });

  if (recipients.length === 0) {
    logger.warn("[riskTriage.notify] no recipients hold CURRICULUM_APPROVE", { contentId });
    return;
  }

  const text = `A lesson was flagged for review by the curriculum risk-triage layer.\n\nContent ID: ${contentId}\nRisk score: ${riskScore}\nReasons: ${riskReasons.join(", ")}\n\nReview: ${reviewUrl()}`;

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendEmail({
          to: recipient.email,
          subject: "Curriculum lesson flagged for review",
          html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
          text,
          type: "curriculum_risk_flagged",
          recipientRole: "user",
          transactional: true,
        });
      } catch (error) {
        logger.warn("[riskTriage.notify] email failed for one recipient", { contentId, error });
      }
    })
  );
}
