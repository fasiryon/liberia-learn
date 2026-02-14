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

function readJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const ewoId = getArg("ewoId");
  const schemaIdArg = getArg("schemaId");
  const agent1Path = getArg("agent1");
  const agent5Path = getArg("agent5") ?? null;
  const governancePath = getArg("governance");
  const governanceModel = getArg("governanceModel") ?? "gpt-4";
  const applyPatch = (getArg("applyPatch") ?? "false") === "true";

  if (!ewoId || !schemaIdArg || !agent1Path || !governancePath) {
    throw new Error("Missing required args: --ewoId --schemaId --agent1 --governance");
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

  const schemaId = finalDoc?.metadata?.id ?? schemaIdArg;

  const contentId = finalDoc?.metadata?.id ?? schemaId;
  const contentType = finalDoc?.content_type;
  const grade = finalDoc?.educational_context?.grade;
  const subject = finalDoc?.educational_context?.subject;
  const version = finalDoc?.metadata?.version ?? "1.0.0";

  if (!contentType || grade === undefined || !subject) {
    throw new Error("Final curriculum doc missing required: content_type, educational_context.grade, educational_context.subject");
  }

  const prisma = new PrismaClient();
  const now = new Date();

  const curriculumContent = await prisma.curriculumContent.upsert({
    where: { contentId },
    create: {
      contentId,
      contentType,
      grade: Number(grade),
      subject: String(subject),
      jsonData: finalDoc,
      status: gov.decision === "ACCEPT" ? "approved" : (appliedPatch ? "review" : "draft"),
      version
    },
    update: {
      jsonData: finalDoc,
      status: gov.decision === "ACCEPT" ? "approved" : (appliedPatch ? "review" : "draft"),
      version
    }
  });

  // IMPORTANT:
  // Your Prisma model currently has governanceDecision/governanceReason, not decision/reason.
  // Write to governanceDecision/governanceReason so TS compiles NOW.
  // Once you update schema.prisma and regenerate, you can also write decision/reason.
  const governed = await prisma.governedArtifact.upsert({
    where: { ewoId },
    create: {
      ewoId,
      schemaId,

      governanceDecision: gov.decision,
      governanceReason: gov.reason,

      artifactJson: {
        agent1Path: path.normalize(agent1Path),
        agent5Path: agent5Path ? path.normalize(agent5Path) : null,
        governancePath: path.normalize(governancePath),
        governanceModel,
        governanceTimestamp: now.toISOString(),
        appliedPatch,
        patch: gov.patch
      },

      curriculumContentId: curriculumContent.id
    },
    update: {
      schemaId,

      governanceDecision: gov.decision,
      governanceReason: gov.reason,

      artifactJson: {
        agent1Path: path.normalize(agent1Path),
        agent5Path: agent5Path ? path.normalize(agent5Path) : null,
        governancePath: path.normalize(governancePath),
        governanceModel,
        governanceTimestamp: now.toISOString(),
        appliedPatch,
        patch: gov.patch
      },

      curriculumContentId: curriculumContent.id
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
