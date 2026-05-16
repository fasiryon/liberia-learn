/**
 * scripts/generate-pending-certs.ts
 *
 * Triggers Canva certificate generation for all pending certificates
 * where canvaUrl is null. Requires ENABLE_CANVA_CERTIFICATES=true and
 * ANTHROPIC_API_KEY to be set in the environment.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-pending-certs.ts
 *
 * Optional env overrides:
 *   CERT_BATCH_LIMIT=10      - max certs to process per run (default: 20)
 *   CERT_DELAY_MS=2000       - delay between generations in ms (default: 2000)
 */

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { generateCertificate } from "../lib/certificates/canvaCertificate";
import { isCanvaCertificatesEnabled, isCertificatesEnabled } from "../lib/serverFlags";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
loadEnv();

const prisma = new PrismaClient();
const isVercelRuntime = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const canvaCertificatesEnabled = isCanvaCertificatesEnabled() || !isVercelRuntime;

const BATCH_LIMIT = Math.max(1, parseInt(process.env.CERT_BATCH_LIMIT ?? "20", 10));
const DELAY_MS = Math.max(0, parseInt(process.env.CERT_DELAY_MS ?? "2000", 10));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logPreflight() {
  const canvaCredential = await prisma.canvaOAuthCredential.findUnique({
    where: { provider: "canva" },
  });

  console.log("[CERTS] Preflight", {
    envLocalLoaded: existsSync(localEnvPath),
    anthropicApiKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    canvaClientConfigPresent: Boolean(
      process.env.CANVA_CLIENT_ID?.trim() &&
        process.env.CANVA_CLIENT_SECRET?.trim() &&
        process.env.CANVA_REDIRECT_URI?.trim()
    ),
    canvaOAuthCredentialPresent: Boolean(canvaCredential),
    canvaEnvAuthorizationTokenPresent: Boolean(process.env.CANVA_MCP_AUTHORIZATION_TOKEN?.trim()),
    canvaFlagEnabled: isCanvaCertificatesEnabled(),
    localFallbackEnabled: !isVercelRuntime,
    canvaCertificatesEnabled,
    certificatesEnabled: isCertificatesEnabled(),
  });
}

async function main() {
  await logPreflight();
  if (!isCertificatesEnabled()) {
    console.error("ENABLE_CERTIFICATES is false - aborting");
    process.exit(1);
  }
  if (!canvaCertificatesEnabled) {
    console.error("ENABLE_CANVA_CERTIFICATES is not true - set it in your environment to proceed");
    process.exit(1);
  }

  const pending = await prisma.certificate.findMany({
    where: { status: "pending", canvaUrl: null },
    orderBy: { createdAt: "asc" },
    take: BATCH_LIMIT,
  });

  console.log(`Found ${pending.length} pending certs (limit ${BATCH_LIMIT})`);

  let generated = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const cert of pending) {
    try {
      const student = await prisma.student.findFirst({
        where: { id: cert.studentId },
        select: {
          id: true,
          currentGrade: true,
          user: {
            select: {
              name: true,
              school: { select: { name: true } },
            },
          },
        },
      });

      const studentName = student?.user?.name ?? "Student";
      const schoolName = student?.user?.school?.name ?? "LiberiaLearn School";
      const grade = student?.currentGrade ?? 1;
      const subject = cert.referenceId ?? "General";
      const completionDate = (cert.awardedAt ?? cert.createdAt).toISOString().slice(0, 10);

      console.log(`Generating cert ${cert.id} for ${studentName} (${subject})...`);

      const result = await generateCertificate({
        studentName,
        schoolName,
        grade,
        subject,
        completionDate,
        certificateId: cert.certificateCode ?? cert.id,
      });

      await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          canvaUrl: result.canvaUrl,
          designId: result.designId,
          status: "completed",
          generatedAt: new Date(),
        },
      });

      generated++;
      console.log(`  ✓ ${cert.id} -> ${result.canvaUrl}`);

      if (DELAY_MS > 0 && generated < pending.length) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ id: cert.id, error: message });
      console.error(`  ✗ ${cert.id}: ${message}`);

      await prisma.certificate.update({
        where: { id: cert.id },
        data: { status: "failed" },
      }).catch(() => {});
    }
  }

  console.log(`\nResult: ${generated} generated, ${failed} failed / ${pending.length} processed`);
  if (failures.length > 0) {
    console.log("Failures:", JSON.stringify(failures, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});

