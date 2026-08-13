import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createCurriculumContent,
  provenanceWritersEnabled,
  updateCurriculumContent,
  upsertCurriculumContent,
} from "@/lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

function desiredStatus(data: { status?: unknown }): string | null {
  return typeof data.status === "string" ? data.status : null;
}

function controlledData(data: any): any {
  if (!provenanceWritersEnabled()) return data;
  const desired = desiredStatus(data)?.trim().toUpperCase();
  if (!desired || desired === "DRAFT") return data;
  return { ...data, status: "draft" };
}

export function createConservativeCurriculumMaintenanceClient(name: string) {
  const context = (operation: string, identity: string) => ({
    revisionKind: "DETERMINISTIC_ENRICHMENT" as const,
    originKind: "DETERMINISTIC_GENERATED" as const,
    actorLabel: name,
    generatorName: name,
    generatorVersion: "1.0.0",
    generatedAt: new Date(),
    requestedCompleteness: "UNVERIFIED" as const,
    auditAction: `curriculum.revision.maintenance_${operation}`,
    auditDetails: { maintenanceTool: name },
    idempotencyKey: `${name}:${operation}:${identity}:${randomUUID()}`,
  });

  async function submitIfRequired(
    contentId: string,
    revisionId: string | undefined,
    requested: string | null,
  ) {
    if (!provenanceWritersEnabled() || !requested || requested.trim().toUpperCase() === "DRAFT") {
      return prisma.curriculumContent.findUniqueOrThrow({ where: { contentId } });
    }
    await appendCurriculumGovernanceEvent({
      contentId,
      revisionId,
      eventType: "SUBMITTED",
      actorType: "SYSTEM",
      actorLabel: name,
      idempotencyKey: `${name}:submitted:${revisionId}`,
    });
    return prisma.curriculumContent.findUniqueOrThrow({ where: { contentId } });
  }

  const client = {
    async create(args: { data: Prisma.CurriculumContentUncheckedCreateInput }) {
      const requested = desiredStatus(args.data);
      const write = await createCurriculumContent(
        controlledData(args.data),
        context("create", String(args.data.contentId)),
      );
      return submitIfRequired(write.content.contentId, write.revision?.id, requested);
    },
    async update(args: { where: Prisma.CurriculumContentWhereUniqueInput; data: Prisma.CurriculumContentUncheckedUpdateInput }) {
      const requested = desiredStatus(args.data);
      const write = await updateCurriculumContent(
        args.where,
        controlledData(args.data),
        context("update", JSON.stringify(args.where)),
      );
      return submitIfRequired(write.content.contentId, write.revision?.id, requested);
    },
    async upsert(args: {
      where: Prisma.CurriculumContentWhereUniqueInput;
      create: Prisma.CurriculumContentUncheckedCreateInput;
      update: Prisma.CurriculumContentUncheckedUpdateInput;
    }) {
      const requested = desiredStatus(args.update) ?? desiredStatus(args.create);
      const write = await upsertCurriculumContent(
        args.where,
        controlledData(args.create),
        controlledData(args.update),
        context("upsert", JSON.stringify(args.where)),
      );
      return submitIfRequired(write.content.contentId, write.revision?.id, requested);
    },
    async updateMany(args: { where?: Prisma.CurriculumContentWhereInput; data: Prisma.CurriculumContentUncheckedUpdateManyInput }) {
      const rows = await prisma.curriculumContent.findMany({ where: args.where, select: { id: true } });
      for (const row of rows) await client.update({ where: { id: row.id }, data: args.data });
      return { count: rows.length };
    },
  };
  return client;
}
