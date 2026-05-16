/**
 * generate-certs-via-rest.ts
 *
 * Creates Canva designs for all failed/pending certificates using the Canva
 * REST API (POST /v1/designs). This bypasses the MCP server and uses the
 * stored OAuth token directly.
 *
 * Usage:
 *   npx dotenv -e .env.production -e .env.local -- \
 *     npx tsx scripts/generate-certs-via-rest.ts
 */

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client";
import { resolveCanvaMcpAuthorizationToken } from "../lib/canva/canvaOAuth";

process.env.CANVA_REDIRECT_URI =
  process.env.CANVA_REDIRECT_URI ||
  "https://liberia-learn.vercel.app/api/admin/canva/callback";

const prisma = new PrismaClient();
const CANVA_API = "https://api.canva.com/rest/v1";
const DELAY_MS = Number(process.env.CERT_DELAY_MS ?? "3500");
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createCanvaDesign(title: string): Promise<{ designId: string; canvaUrl: string }> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(60_000, 10_000 * 2 ** (attempt - 1));
      console.log(`  ↻ retry ${attempt}/${MAX_RETRIES - 1} after ${backoff / 1000}s`);
      await sleep(backoff);
    }
    const token = await resolveCanvaMcpAuthorizationToken();
    const res = await fetch(`${CANVA_API}/designs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        design_type: { type: "preset", name: "presentation" },
      }),
    });

    if (res.status === 429) {
      lastError = new Error(`Canva rate-limited (429)`);
      continue;
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Canva API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const designId = data?.design?.id as string | undefined;
    if (!designId) throw new Error("No design ID in response");
    return { designId, canvaUrl: `https://www.canva.com/design/${designId}/edit` };
  }
  throw lastError ?? new Error("Max retries exceeded");
}

async function main() {
  const certs = await prisma.certificate.findMany({
    where: { status: { in: ["failed", "pending"] }, canvaUrl: null },
    orderBy: { createdAt: "asc" },
    include: {
      student: {
        select: {
          currentGrade: true,
          user: { select: { name: true, school: { select: { name: true } } } },
        },
      },
    },
  });

  console.log(`Found ${certs.length} certificates to generate`);

  let success = 0;
  let failed = 0;

  for (const cert of certs) {
    const studentName = cert.student?.user?.name ?? "Student";
    const subject = cert.referenceId ?? "General";
    const title = `Certificate – ${studentName} – ${subject}`;

    try {
      const result = await createCanvaDesign(title);
      if (!result) throw new Error("No result from Canva");

      await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          canvaUrl: result.canvaUrl,
          designId: result.designId,
          status: "completed",
          generatedAt: new Date(),
        },
      });

      success++;
      console.log(`  ✓ [${success}/${certs.length}] ${studentName} → ${result.designId}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${cert.id} (${studentName}): ${err.message}`);
      await prisma.certificate
        .update({ where: { id: cert.id }, data: { status: "failed" } })
        .catch(() => {});
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${success} completed, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  prisma.$disconnect().finally(() => process.exit(1));
});
