/**
 * Sprint 6.1 Deliverable 10: full SMS simulator end-to-end test, run
 * directly against handleGuardianInbound() (bypassing the Next.js route's
 * NODE_ENV production gate, since local `next dev` is not viable on this
 * machine - see feedback_regen_pitfalls memory). AGENT_GUARDIAN_ENABLED is
 * set in THIS SCRIPT'S OWN process env only - does not touch Vercel's real
 * production config, so live guardian traffic is unaffected.
 *
 * Makes real LLM calls (small real cost, a few cents) and real DB writes
 * against demo fixtures (guardian1@cha.family.lr / Pewu Gongloe). SMS sends
 * go through DryRunSMSProvider (ENABLE_LIVE_SMS unset) - no real SMS cost.
 * Re-runnable; resets conversation state for the two test phone numbers at
 * the start of each run.
 *
 * Run: npx dotenv -e .env.production -- npx tsx scripts/verify-guardian-agent-e2e.ts
 */
process.env.AGENT_GUARDIAN_ENABLED = "true";

import "@/lib/agents/bootstrap";
import { prisma } from "@/lib/db";
import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";

const KNOWN_PHONE = "+231000000001"; // guardian1@cha.family.lr, set below
const UNKNOWN_PHONE = "+231000000099";

async function step(label: string, from: string, text: string) {
  console.log(`\n=== ${label} ===`);
  console.log(`IN  (${from}): ${text}`);
  const result = await handleGuardianInbound({ from, text });
  console.log(`OUT: [${result.agentStatus}] ${result.response ?? "(no response)"}`);
  return result;
}

async function main() {
  // Setup: known-number guardian (idempotent), clean any prior conversation
  // state for these two test numbers so the run is deterministic.
  await prisma.user.update({
    where: { email: "guardian1@cha.family.lr" },
    data: { guardianPhoneE164: KNOWN_PHONE, smsOptIn: true, preferredChannel: "SMS" },
  });
  await prisma.guardianConversation.deleteMany({ where: { guardianPhone: { in: [KNOWN_PHONE, UNKNOWN_PHONE] } } });

  const student = await prisma.user.findUnique({
    where: { email: "guardian1@cha.family.lr" },
    select: { guardianOf: { select: { student: { select: { humanReadableStudentId: true, user: { select: { name: true } } } } } } },
  });
  const studentCode = student!.guardianOf[0].student.humanReadableStudentId!;
  const studentName = student!.guardianOf[0].student.user.name!;
  console.log(`Demo student: ${studentName}, code ${studentCode}`);

  // 1. Greeting, known number.
  await step("1. Greeting (known number)", KNOWN_PHONE, "Hi");

  // 2. Weekly report.
  await step("2. Weekly report request", KNOWN_PHONE, "1");

  // 3. Progress question.
  await step("3. Progress question", KNOWN_PHONE, "How is my son doing in math?");

  // 4. Safeguarding trigger.
  await step("4. Safeguarding trigger", KNOWN_PHONE, "My child says the teacher hit him yesterday");

  // 5. Follow-up after safeguarding (should stay warm/normal).
  await step("5. Follow-up after safeguarding", KNOWN_PHONE, "Thank you, what about his homework?");

  // 6. Unknown number cold contact.
  await step("6. Unknown number, cold contact", UNKNOWN_PHONE, "Hi");

  // 7. Valid challenge response.
  await step("7. Valid challenge response", UNKNOWN_PHONE, `${studentCode} ${studentName}`);

  // 8. Follow-up after verification.
  await step("8. Follow-up after verification", UNKNOWN_PHONE, "What is his attendance like?");

  // --- Verification queries ---
  console.log("\n=== Verification ===");

  const invocations = await prisma.agentInvocation.findMany({
    where: { agentName: "liberialearn-family", createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true, status: true, llmCostUSD: true, toolCalls: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`AgentInvocation rows (last 10 min): ${invocations.length}`);
  for (const inv of invocations) {
    console.log(`  - ${inv.id} status=${inv.status} cost=$${inv.llmCostUSD} tools=${JSON.stringify(inv.toolCalls).slice(0, 200)}`);
  }

  const escalations = await prisma.escalationQueue.findMany({
    where: { agentName: "liberialearn-family", createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true, reason: true, priority: true, status: true, userId: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nEscalationQueue rows (last 10 min): ${escalations.length}`);
  for (const e of escalations) {
    console.log(`  - ${e.id} priority=${e.priority} status=${e.status} userId=${e.userId} reason=${e.reason.slice(0, 120)}`);
  }

  const smsCost = await prisma.guardianSmsCostAccounting.findMany({
    where: { guardianPhone: { in: [KNOWN_PHONE, UNKNOWN_PHONE] } },
  });
  console.log(`\nGuardianSmsCostAccounting rows: ${smsCost.length}`);
  for (const c of smsCost) {
    console.log(`  - ${c.guardianPhone} segments=${c.outboundSegments} count=${c.outboundCount} cost=$${c.estimatedCostUSD.toFixed(4)}`);
  }

  const conversations = await prisma.guardianConversation.findMany({
    where: { guardianPhone: { in: [KNOWN_PHONE, UNKNOWN_PHONE] } },
  });
  console.log(`\nGuardianConversation rows: ${conversations.length}`);
  for (const c of conversations) {
    console.log(
      `  - ${c.guardianPhone} guardianId=${c.guardianId} verifiedAt=${c.verifiedAt} messages=${(c.state as any)?.messages?.length ?? 0}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("E2E test failed:", e);
  process.exit(1);
});
