import { ConsentAcceptanceModal } from "@/components/ConsentAcceptanceModal";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/auth";
import { CURRENT_POLICY_VERSION, DATA_POLICY_KEY } from "@/lib/policy/policyVersion";

export async function ConsentGate() {
  const user = await getOptionalUser();
  if (!user?.id) return null;

  const accepted = await prisma.dataPolicyAcceptance.findFirst({
    where: {
      userId: user.id,
      policyKey: DATA_POLICY_KEY,
      policyVersion: CURRENT_POLICY_VERSION,
    },
    select: { id: true },
  });

  return (
    <ConsentAcceptanceModal
      initialAccepted={Boolean(accepted)}
      policyVersion={CURRENT_POLICY_VERSION}
    />
  );
}
