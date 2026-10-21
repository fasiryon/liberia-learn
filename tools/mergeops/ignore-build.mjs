import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { previewDecision } from './budget.mjs';

// Optional Vercel Ignored Build Step: exit 0 skips; exit 1 continues.
// It is supplied for explicit operator activation, not installed into the existing deployment path.
try {
  const files = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim().split('\n').filter(Boolean);
  // An operator-owned report must be provided by a separately reviewed budget gate.
  const evidence = process.env.MERGEOPS_PREVIEW_EVIDENCE ? JSON.parse(readFileSync(process.env.MERGEOPS_PREVIEW_EVIDENCE, 'utf8')) : {};
  const decision = previewDecision({ branch: process.env.VERCEL_GIT_COMMIT_REF ?? '', environment: process.env.VERCEL_ENV, files,
    usage: evidence.usage ?? { allowPreview: false }, approvedSha: evidence.approvedSha, head: process.env.VERCEL_GIT_COMMIT_SHA });
  console.log(`MergeOps build policy: ${decision.reason}`);
  process.exitCode = decision.allow ? 1 : 0;
} catch { console.log('MergeOps build policy: missing evidence; skip build'); process.exitCode = 0; }
