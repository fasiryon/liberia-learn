import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

type Manifest = {
  generated_at: string;
  root: string;
  count: number;
  items: { grade: number; subject: string; path: string }[];
};

const prisma = new PrismaClient();

function sha256(obj: unknown) {
  const json = JSON.stringify(obj);
  return crypto.createHash("sha256").update(json).digest("hex");
}

async function main() {
  const manifestPath = path.resolve("FactoryArtifacts/Subjects/manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;

  let upserted = 0;

  for (const item of manifest.items) {
    const absPath = path.resolve(item.path);
    if (!fs.existsSync(absPath)) throw new Error(`Missing file: ${absPath}`);

    const payload = JSON.parse(fs.readFileSync(absPath, "utf8"));

    const contentId = payload?.metadata?.id;
    const version = payload?.metadata?.version ?? "0.0.0";
    const status = payload?.metadata?.status ?? "draft";
    const contentType = payload?.content_type ?? "FULL_SUBJECT";

    if (!contentId) throw new Error(`No metadata.id in ${item.path}`);

    const hash = sha256(payload);

    await prisma.curriculumContent.upsert({
      where: { contentId },
      create: {
        contentId,
        grade: item.grade,
        subject: item.subject,
        contentType,
        status,
        version,
        payload,
        hash,
      },
      update: {
        grade: item.grade,
        subject: item.subject,
        contentType,
        status,
        version,
        payload,
        hash,
      },
    });

    upserted++;
    if (upserted % 25 === 0) console.log(`✅ Upserted ${upserted}/${manifest.count}`);
  }

  console.log(`🎉 Done. Upserted ${upserted} curriculum artifacts.`);
}

main()
  .catch((e) => {
    console.error("❌ Ingest failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
