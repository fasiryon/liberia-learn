/**
 * Visual Teaching Block Registry `teaching-blocks/1.3.0` (additive). FROZEN (CoS ACCEPT, COS-REGISTRY-1.3-ACCEPT.md, 2026-10-26):
 * shape accepted by CoS (COS-STEM-REGISTRY-1.3-AMENDMENT.md, 2026-10-26); golden check in
 * __tests__/learning-v4/registry-golden.test.ts. Once CoS freezes it, change it only through a new additive version;
 * packages sealed under 1.3.0 name the commit that froze this file.
 *
 * - 1.1.0 (./registry.ts) and 1.2.0 (./registry-1.2.ts) stay byte-identical: their schemas, entries and validators are
 *   imported, never edited, so packages sealed under either keep validating exactly as before.
 * - The one change: DESIGN_CYCLE may name its MEASUREMENT_TABLE with an optional `measurement` link, so each design's
 *   test results are the matching trial row of that table (design 1 = trial 1, ...). Without the link a 1.3.0
 *   DESIGN_CYCLE is exactly a 1.2.0 one. (Founder approval for contract review, 2026-10-26.)
 * - The version dispatcher for 1.1.0 / 1.2.0 / 1.3.0 lives in ./registries.ts (CoS ruling), not here.
 * - Link rules: every criterion maps to exactly one table column with the same unit and a target inside that column's
 *   minimum..maximum; the table is in the same package,
 *   is MEASURED_BY_LEARNER (so never pre-filled) and has a trial row for every possible design; one cycle per table.
 */
import { z } from "zod";
import { BLOCK_SCHEMAS_1_2, TEACHING_BLOCK_REGISTRY_1_2, validateBlock_1_2, validateBlockReferences_1_2,
  type BlockContext_1_2, type BlockType_1_2, type RegistryEntry_1_2 } from "./registry-1.2";

export const TEACHING_BLOCK_REGISTRY_VERSION_1_3 = "teaching-blocks/1.3.0" as const;

const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
/** Which table column holds each criterion's measured result. */
export const MEASUREMENT_LINK_SCHEMA = z.strictObject({ tableId: id, criterionColumns: z.array(z.strictObject({ criterionId: id, columnId: id })).min(1).max(6) });

const DESIGN_CYCLE_1_3 = BLOCK_SCHEMAS_1_2.DESIGN_CYCLE.extend({ measurement: MEASUREMENT_LINK_SCHEMA.optional() }).superRefine((v, c) => {
  if (!v.measurement) return;
  const criteria = v.criteria.map((x) => x.id), mapped = v.measurement.criterionColumns.map((x) => x.criterionId), columns = v.measurement.criterionColumns.map((x) => x.columnId);
  if (new Set(mapped).size !== mapped.length || mapped.length !== criteria.length || criteria.some((x) => !mapped.includes(x))) c.addIssue({ code: "custom", message: "measurement_criteria_unmapped" });
  if (new Set(columns).size !== columns.length) c.addIssue({ code: "custom", message: "measurement_column_reused" });
});

export const BLOCK_SCHEMAS_1_3 = Object.freeze({ ...BLOCK_SCHEMAS_1_2, DESIGN_CYCLE: DESIGN_CYCLE_1_3 });
export type BlockType_1_3 = BlockType_1_2;
export type VisualBlock_1_3 = { [K in BlockType_1_3]: z.infer<(typeof BLOCK_SCHEMAS_1_3)[K]> }[BlockType_1_3];
export type DesignCycle_1_3 = z.infer<typeof DESIGN_CYCLE_1_3>;

/** Entries are 1.2.0's; DESIGN_CYCLE's purpose names the optional link. Applicability and timing are unchanged. */
export const TEACHING_BLOCK_REGISTRY_1_3: Readonly<Record<BlockType_1_3, RegistryEntry_1_2>> = Object.freeze({
  ...TEACHING_BLOCK_REGISTRY_1_2,
  DESIGN_CYCLE: Object.freeze({ ...TEACHING_BLOCK_REGISTRY_1_2.DESIGN_CYCLE,
    purpose: "Define a problem, test a design against criteria and constraints, and improve it across iterations; optionally record each design's results in a named measurement table." }),
});

/** Strict 1.3.0 parse plus the 1.2.0 semantics and subject/grade fit. `problems` empty means the block may be rendered. */
export function validateBlock_1_3(input: unknown, context?: BlockContext_1_2): { block: VisualBlock_1_3 | null; problems: string[] } {
  const type = typeof input === "object" && input !== null && "type" in input ? String((input as { type: unknown }).type) : "";
  if (type !== "DESIGN_CYCLE") return validateBlock_1_2(input, context);
  const parsed = DESIGN_CYCLE_1_3.safeParse(input);
  if (!parsed.success) return { block: null, problems: parsed.error.issues.slice(0, 5).map((issue) => `block_schema:DESIGN_CYCLE:${issue.path.join(".") || "$"}:${issue.message}`) };
  // Fit and semantics are 1.2.0's: the link is the only difference, so check the block without it.
  const { measurement: _link, ...base } = parsed.data;
  return { block: parsed.data, problems: validateBlock_1_2(base, context).problems };
}

/** Same-package references: 1.2.0's (GRAPH_BUILDER) plus every DESIGN_CYCLE measurement link. */
export function validateBlockReferences_1_3(blocks: readonly VisualBlock_1_3[]): string[] {
  const problems = validateBlockReferences_1_2(blocks.map((b) => (b.type === "DESIGN_CYCLE" ? (({ measurement: _m, ...rest }) => rest)(b) : b)) as Parameters<typeof validateBlockReferences_1_2>[0]);
  const linked = new Map<string, string>();
  for (const block of blocks) if (block.type === "DESIGN_CYCLE" && block.measurement) {
    const link = block.measurement, table = blocks.find((b) => "id" in b && b.id === link.tableId);
    if (table?.type !== "MEASUREMENT_TABLE") { problems.push(`design_measurement_reference_invalid:${block.id}`); continue; }
    if (table.origin !== "MEASURED_BY_LEARNER") problems.push(`design_measurement_table_not_learner:${block.id}`);
    if (table.trials.length < block.maxIterations) problems.push(`design_measurement_too_few_trials:${block.id}`);
    for (const { criterionId, columnId } of link.criterionColumns) {
      const column = table.columns.find((c) => c.id === columnId), criterion = block.criteria.find((c) => c.id === criterionId);
      if (!column) problems.push(`design_measurement_column_unknown:${block.id}:${columnId}`);
      else if (criterion && column.unit !== criterion.unit) problems.push(`design_measurement_unit_mismatch:${block.id}:${criterionId}`);
      // A target the column cannot hold could never be reached by a valid entry (CoS final condition 2).
      else if (criterion && (criterion.target < column.minimum || criterion.target > column.maximum)) problems.push(`design_measurement_target_out_of_range:${block.id}:${criterionId}`);
    }
    if (linked.has(link.tableId)) problems.push(`design_measurement_table_shared:${link.tableId}`);
    linked.set(link.tableId, block.id);
  }
  return problems;
}
