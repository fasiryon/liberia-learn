import { execSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";
import type { AcceptanceCriterion, CriterionResult } from "@/lib/autonomous/missionLoop/types";

export type CommandRunner = (command: string) => { exitCode: number; output: string };

export function defaultCommandRunner(command: string): { exitCode: number; output: string } {
  try {
    const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exitCode: 0, output };
  } catch (error) {
    const execError = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const output = `${execError.stdout ?? ""}${execError.stderr ?? ""}`;
    return { exitCode: execError.status ?? 1, output };
  }
}

async function evaluateOne(
  criterion: AcceptanceCriterion,
  db: PrismaClient,
  runCommand: CommandRunner,
): Promise<CriterionResult> {
  if (criterion.type === "command") {
    const { exitCode, output } = runCommand(criterion.command);
    return {
      criterion,
      passed: exitCode === 0,
      detail:
        exitCode === 0
          ? `"${criterion.label}" passed`
          : `"${criterion.label}" failed (exit ${exitCode}): ${output.slice(-500)}`,
    };
  }
  if (criterion.type === "approval_resolved") {
    const approval = await db.approvalRequest.findUnique({ where: { id: criterion.approvalRequestId } });
    const passed = approval?.status === "APPROVED";
    return {
      criterion,
      passed,
      detail: approval
        ? `ApprovalRequest ${criterion.approvalRequestId} status is ${approval.status}`
        : `ApprovalRequest ${criterion.approvalRequestId} not found`,
    };
  }
  const task = await db.qualityReviewTask.findUnique({
    where: { id: criterion.qualityReviewTaskId },
    include: { assessment: true },
  });
  const passed = task?.status === "DECIDED" && task.assessment?.outcome === "PASS";
  return {
    criterion,
    passed,
    detail: task
      ? `QualityReviewTask ${criterion.qualityReviewTaskId} status ${task.status}, outcome ${task.assessment?.outcome ?? "none"}`
      : `QualityReviewTask ${criterion.qualityReviewTaskId} not found`,
  };
}

export async function evaluateAcceptanceCriteria(
  criteria: AcceptanceCriterion[],
  db: PrismaClient,
  runCommand: CommandRunner = defaultCommandRunner,
): Promise<{ passed: boolean; results: CriterionResult[] }> {
  const results: CriterionResult[] = [];
  for (const criterion of criteria) {
    results.push(await evaluateOne(criterion, db, runCommand));
  }
  return { passed: results.every((result) => result.passed), results };
}
