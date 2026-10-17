/** Explicitly synthetic capacity fixture. These ten IDs never identify real legacy lessons. */
import fs from "fs";
import { demoBlueprint, demoExecutors } from "./demo";
import { BATCH_VERSION, bytesHash, type BatchContract } from "./batchContract";
import { FACTORY_ROLES, sealBlueprint, type ExactPin } from "./blueprint";
import { inventoryLegacy } from "./inventory";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import type { BatchActors } from "./batch";

export async function tenLessonFixture() {
  const base = demoBlueprint();
  const contractBytes = Buffer.from("SYNTHETIC ten-lesson capacity exercise. No curriculum authority or production evidence.");
  const curriculumContract: ExactPin = { id: "synthetic-ten-contract", version: "1.0.0", sha256: bytesHash(contractBytes), sourceRef: "fixture:synthetic-contract" };
  const inventory = {
    schemaVersion: "factory-legacy-inventory/1.0.0" as const, environment: "REPOSITORY_FIXTURE" as const,
    capturedAt: "2026-10-17T00:00:00.000Z", queryRef: "fixture:no-production-access",
    lessons: Array.from({ length: 10 }, (_, index) => {
      const contentSnapshot = { identity: { grade: 7, subject: "MATH", title: `Synthetic decimal lesson ${index + 1}` }, delivery: { body: `SYNTHETIC legacy ${index + 1}. In 32.45, identify the value of each digit.` } };
      return { databaseId: `synthetic-row-${index + 1}`, contentId: `synthetic-logical-${index + 1}`, grade: 7, subject: "MATH", contentType: "LESSON", version: "1.0.0", status: "PUBLISHED", revisionId: `synthetic-revision-${index + 1}`, revisionNumber: 3,
        snapshotSchemaVersion: 1, contentSnapshot, contentHash: hashCurriculumSnapshot(1, contentSnapshot),
        relationshipCounts: { assignments: index, submissions: index * 2, learningEvents: index * 3, scheduledWork: index },
      };
    }),
  };
  const report = inventoryLegacy(inventory);
  const executors = demoExecutors();
  const drafts = Object.fromEntries(await Promise.all(FACTORY_ROLES.map(async role => [role, await executors[role]({ blueprint: base, dependencies: [], attempt: 1, previousFailures: [], quality: null })])));
  const generationBytes = Buffer.from(JSON.stringify(drafts));
  const generation = { id: "synthetic-template-drafts", version: "0.1.0", sha256: bytesHash(generationBytes), sourceRef: "fixture:demoExecutors" };
  const contract: BatchContract = {
    schemaVersion: BATCH_VERSION, batchId: "synthetic-capacity-ten", version: "1.0.0", curriculumContract,
    documents: [{ pin: curriculumContract, bytesBase64: contractBytes.toString("base64") }, ...base.sources.map(pin => ({ pin, bytesBase64: fs.readFileSync("curriculum/excellence/g7-v0.2.0/source.json").toString("base64") }))],
    inventoryHash: report.inventoryHash, evidence: { kind: "SYNTHETIC", notice: "Ten synthetic sources and deterministic templates. No actual legacy modernization or independent review performed." },
    lessons: report.rows.map(row => {
      const source = { databaseId: row.databaseId, contentId: row.contentId, revisionId: row.revisionId!, revisionNumber: row.revisionNumber!, snapshotSha256: row.contentHash! };
      const candidateId = `synthetic-candidate-${row.databaseId}`;
      return { candidateId, candidateVersion: "0.1.0", source, generation, assets: [], blueprint: sealBlueprint({ ...base, blueprintId: candidateId,
        provenance: [...base.provenance, curriculumContract], legacy: [{ ...source, inventoryPin: { id: "synthetic-inventory", version: "1.0.0", sha256: report.inventoryHash, sourceRef: inventory.queryRef } }],
      }) };
    }),
  };
  const actors = Object.fromEntries(FACTORY_ROLES.map(role => [role, { kind: "AI", agentId: `synthetic:${role}`, modelFamily: "deterministic-template", sessionId: `synthetic:${role}` }])) as BatchActors;
  return { contract, inventory, actors, generationBytes,
    generationInputs: Object.fromEntries(contract.lessons.map(l => [l.candidateId, generationBytes.toString("base64")])),
  };
}
