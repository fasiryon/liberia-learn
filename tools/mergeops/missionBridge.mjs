import { verify } from './ledger.mjs';

// Dependency injection reuses the existing autonomous workflow writer without giving CI database access.
// Run only in an independently authorized environment; no schema or competing WorkflowRun table.
export async function importMission(records, { createWorkflowRun, recordWorkflowCheckpoint }) {
  verify(records);
  if (!records.length) return null;
  const { mission } = records[0];
  if (records.some(r => r.mission !== mission)) throw Error('mixed-mission-ledger');
  const { workflowRun } = await createWorkflowRun({ workflowType: 'engineering.mergeops.v1', source: 'github', targetType: 'GitHubPullRequest', targetId: mission,
    idempotencyKey: `mergeops:${mission}`, riskLevel: 'high', approvalRequired: true, executionMetadata: { authority: 'github-protection', importedOnly: true } });
  for (const r of records) await recordWorkflowCheckpoint({ workflowRunId: workflowRun.id, checkpointKey: r.type, actorType: 'system', actorId: 'mergeops',
    idempotencyKey: `mergeops:${r.hash}`, state: { ledgerHash: r.hash, head: r.head, details: r.details }, evidenceRefs: { delivery: r.delivery } });
  return workflowRun.id;
}
