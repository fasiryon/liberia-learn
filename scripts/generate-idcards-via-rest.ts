/**
 * generate-idcards-via-rest.ts
 *
 * Creates Canva designs for all students without a completed ID card using
 * the Canva REST API (POST /v1/designs). This bypasses the MCP server and
 * uses the stored OAuth token directly.
 *
 * Usage:
 *   npx dotenv -e .env.production -e .env.local -- \
 *     npx tsx scripts/generate-idcards-via-rest.ts
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
  // Find a platform admin to use as requestedBy
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN" as any, "TEACHER" as any] } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    throw new Error("No admin user found — cannot set requestedBy");
  }
  console.log(`Using requestedBy: ${admin.name} (${admin.id})`);

  // Find students without a completed ID card
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" as any },
    include: { school: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const alreadyDone = new Set<string>(
    (
      await prisma.generatedDocument.findMany({
        where: { type: "STUDENT_ID_CARD", status: "COMPLETED", studentId: { not: null } },
        select: { studentId: true },
      })
    )
      .map((d) => d.studentId)
      .filter(Boolean) as string[]
  );

  // Only include students with a valid schoolId (FK constraint)
  const pending = students.filter((s) => !alreadyDone.has(s.id) && (s.schoolId || s.school?.id));
  console.log(`Total students: ${students.length}, already have card: ${alreadyDone.size}, need card: ${pending.length}`);

  let success = 0;
  let failed = 0;

  for (const student of pending) {
    const studentName = student.name ?? "Student";
    const studentNumber = student.id.slice(-8).toUpperCase();
    const schoolName = student.school?.name ?? "LiberiaLearn School";
    const title = `ID Card – ${studentName} (${studentNumber}) – ${schoolName}`;

    try {
      const result = await createCanvaDesign(title);

      await prisma.generatedDocument.create({
        data: {
          schoolId: student.schoolId ?? student.school?.id ?? "",
          studentId: student.id,
          type: "STUDENT_ID_CARD",
          status: "COMPLETED",
          canvaDesignId: result.designId,
          canvaUrl: result.canvaUrl,
          downloadUrl: result.canvaUrl,
          requestedBy: admin.id,
          metadata: {
            studentName,
            studentNumber,
            schoolName,
            grade: (student as any).gradeLevel?.toString() ?? "",
            academicYear: "2025–2026",
            generatedVia: "canva-rest-api",
          },
        },
      });

      success++;
      console.log(`  ✓ [${success}/${pending.length}] ${studentName} → ${result.designId}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${student.id} (${studentName}): ${err.message}`);
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${success} ID cards created, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  prisma.$disconnect().finally(() => process.exit(1));
});
