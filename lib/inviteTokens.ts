import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export async function findInviteByToken(token: string) {
  const tokenHash = hashToken(token);
  return prisma.inviteToken.findFirst({
    where: {
      OR: [{ tokenHash }, { token }],
    },
  });
}
