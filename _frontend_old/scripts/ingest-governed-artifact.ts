import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import * as jsonpatch from "fast-json-patch";

type Decision = "ACCEPT" | "REPAIR" | "REJECT";

type GovernancePatchOp = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: any;
};

type GovernanceResult = {
  decision: Decision;
  reason: string;
  patch: GovernancePatchOp[];
};

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function pickArg(...names: string[]): string | undefined {
  for (const n of names) {
    const v = getArg(n);
    if (v !== undefined) return v;
  }
  return undefined;
}

function readJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  // Accept both --ewo and --ewoId for compatibility with your pipeline
  const ewoId = pickArg("ewoId", "ewo");
  const schemaIdArg = pickArg("schemaId");
  const agent1Path = pickArg("agent1", "agent1Path");
  const agent5Path = pickArg("agent5") ?? null;
  const governancePath = pickArg("governance", "governancePath");
  const governanceModel = pickArg("governanceModel") ?? "gpt-4";
  const applyPatch = (pickArg("applyPatch") ?? "false") === "true";

  if (!ewoId || !schemaIdArg || !agent1Path || !governancePath) {
    throw new Error("Missing required args: --ewo/--ewoId --schemaId --agent1 --governance");
  }

  const agent1 = readJson(agent1Path);
  const gov = readJson(governancePath) as GovernanceResult;

  if (!gov.decision || !gov.reason || !Array.isArray(gov.patch)) {
    throw new Error("Governance JSON must include: decision, reason, patch[]");
  }

  if (gov.decision === "REJECT") {
    console.log(JSON.stringify({ ok: false, decision: "REJECT", reason: gov.reason }, null, 2));
    process.exit(2);
  }

  let appliedPatch = false;
  let finalDoc = agent1;

  if (gov.decision === "REPAIR") {
    if (!gov.patch.length) throw new Error("REPAIR decision requires non-empty patch array.");

    if (applyPatch) {
      const cloned = JSON.parse(JSON.stringify(agent1));
      const res = jsonpatch.applyPatch(cloned, gov.patch as any, true);
      finalDoc = res.newDocument;
      appliedPatch = true;
    }
  }

  // Use metadata.id when possible (matches your schema intent)
  const schemaId = finalDoc?.metadata?.id ?? schemaIdArg;
  const contentId = finalDoc?.metadata?.id ?? schemaId;
  const contentType = finalDoc?.content_type;
  const grade = finalDoc?.educational_context?.grade;
  const subject = finalDoc?.educational_context?.subject;
  const version = finalDoc?.metadata?.version ?? "1.0.0";
  const title = finalDoc?.title ?? "(untitled)";
  const description = finalDoc?.description ?? null;

  if (!contentType || grade === undefined || !subject) {
    throw new Error("Final curriculum doc missing required: content_type, educational_context.grade, educational_context.subject");
  }

  const prisma = new PrismaClient();
  const now = new Date();

  // Upsert CurriculumContent
  const curriculumContent = await prisma.curriculumContent.upsert({
    where: { contentId },
    create: {
      contentId,
      contentType: String(contentType),
      grade: Number(grade),
      subject: String(subject),
      title: String(title),
      description: description ? String(description) : null,
      jsonData: finalDoc,
      status: gov.decision === "ACCEPT" ? "approved" : (appliedPatch ? "review" : "draft"),
      version
    },
    update: {
      contentType: String(contentType),
      grade: Number(grade),
      subject: String(subject),
      title: String(title),
      description: description ? String(description) : null,
      jsonData: finalDoc,
      status: gov.decision === "ACCEPT" ? "approved" : (appliedPatch ? "review" : "draft"),
      version
    }
  });

  // Upsert GovernedArtifact (matches your prisma model fields)
  const governed = await prisma.governedArtifact.upsert({
    where: { ewoId },
    create: {
      ewoId,
      schemaId,
      governanceDecision: gov.decision,
      governanceReason: gov.reason,
      artifactJson: {
        finalDoc,
        governance: gov,
        appliedPatch,
        governanceModel,
        paths: {
          agent1Path: path.normalize(agent1Path),
          agent5Path: agent5Path ? path.normalize(agent5Path) : null,
          governancePath: path.normalize(governancePath)
        },
        timestamps: {
          ingestedAt: now.toISOString()
        },
        curriculumContent: {
          contentId: curriculumContent.contentId
        }
      }
    },
    update: {
      schemaId,
      governanceDecision: gov.decision,
      governanceReason: gov.reason,
      artifactJson: {
        finalDoc,
        governance: gov,
        appliedPatch,
        governanceModel,
        paths: {
          agent1Path: path.normalize(agent1Path),
          agent5Path: agent5Path ? path.normalize(agent5Path) : null,
          governancePath: path.normalize(governancePath)
        },
        timestamps: {
          ingestedAt: now.toISOString()
        },
        curriculumContent: {
          contentId: curriculumContent.contentId
        }
      }
    }
  });

  console.log(JSON.stringify({
    ok: true,
    decision: gov.decision,
    appliedPatch,
    contentId: curriculumContent.contentId,
    curriculumContentDbId: curriculumContent.id,
    governedArtifactDbId: governed.id
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
