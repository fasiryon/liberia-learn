/**
 * Client-level database guards (DB-AUDIT-USE-INERT repair, Revision 3). Prisma removed `$use` in 6.14, so the
 * former lib/db.ts middleware never registered on the installed 6.19 client. These guards use the supported query
 * extension (`$extends` with `$allModels.$allOperations`), which runs for the root client, for interactive
 * transaction clients derived from it and for every operation of a batch transaction, before the query engine.
 *
 *  1. Audit immutability: AuditLog update/updateMany/updateManyAndReturn/upsert/delete/deleteMany are refused while
 *     ENABLE_AUDIT_IMMUTABILITY is on (the default). AuditLog create and reads are unaffected.
 *  2. Preview official-records freeze: on a deployed Preview/staging, every write to PREVIEW_FROZEN_RECORD_MODELS
 *     is refused (B5 default refusal). Production and local runs are unaffected; DEMO_MODE does not reopen it.
 *
 * NOT covered, by construction (database triggers, grants and RLS remain the boundary, T2): $executeRaw/$queryRaw,
 * nested writes issued through another model's operation (e.g. user.update({ data: { student: { update } } })),
 * and any PrismaClient constructed outside lib/db.ts (seeds, scripts). An application guard is not a substitute
 * for database immutability.
 */
import { isAuditImmutabilityEnabled } from "@/lib/serverFlags";
import { logger } from "@/lib/logger";
import { previewAutomationDisabled } from "@/lib/previewSideEffects";
import { PREVIEW_FROZEN_RECORD_MODELS, PREVIEW_RECORDS_FROZEN } from "@/lib/preview/recordsFreeze";

export const AUDIT_LOG_IMMUTABLE = "AUDIT_LOG_IMMUTABLE";
export const AUDIT_MUTATION_OPERATIONS: ReadonlySet<string> = new Set([
  "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany",
]);
export const WRITE_OPERATIONS: ReadonlySet<string> = new Set([
  "create", "createMany", "createManyAndReturn", ...AUDIT_MUTATION_OPERATIONS,
]);

export class DbGuardError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "DbGuardError";
  }
}

/** Throws when the operation is refused; returns normally otherwise. Pure apart from env/flag reads. */
export function assertDbOperationAllowed(model: string | undefined, operation: string): void {
  if (!model) return;
  if (model === "AuditLog" && AUDIT_MUTATION_OPERATIONS.has(operation) && isAuditImmutabilityEnabled()) {
    logger.warn("[AUDIT] blocked AuditLog mutation", { action: operation });
    // Message kept from the former middleware for callers and logs that match it.
    throw new DbGuardError("AuditLog mutations are forbidden", AUDIT_LOG_IMMUTABLE, 500);
  }
  if (WRITE_OPERATIONS.has(operation) && PREVIEW_FROZEN_RECORD_MODELS.has(model) && previewAutomationDisabled()) {
    throw new DbGuardError("Official records are read-only in this Preview", PREVIEW_RECORDS_FROZEN, 403);
  }
}

/**
 * A plain extension object (equivalent to Prisma.defineExtension) so this module does not need the Prisma namespace
 * at import time; tests that mock @prisma/client with a bare PrismaClient keep working.
 */
export const dbGuardExtension = {
  name: "liberialearn-db-guards",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: {
        model?: string;
        operation: string;
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }) {
        assertDbOperationAllowed(model, operation);
        return query(args);
      },
    },
  },
} as const;
