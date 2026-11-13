import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import ignore from 'ignore';

const rules=ignore().add(readFileSync('.vercelignore','utf8'));
describe('Preview source upload keeps runtime inputs and excludes private evidence',()=>{
  it.each([
    '.env.preview.local','docs/audits/PROJECT_ATLAS/RISK_REGISTER.md',
    'docs/security/reproduction.md','docs/qa/draft6/security/result.json',
    '__tests__/security/prod-cfg-01.test.ts','e2e/g4-school-day.spec.ts',
    'artifacts/t2-g4-e2e-20261029/preview-upload-manifest.json',
    'artifacts/pilot-security/reproduction.json',
    'artifacts/curriculum-cleanup-v1/CLEANUP_PLAN_V1.md',
    'curriculum/program/stem-v1/security/acceptance/evidence/RED.json',
    '.worktrees/another-agent/source.ts','.claude/agents/security-auditor.md',
  ])('excludes %s',file=>expect(rules.ignores(file)).toBe(true));
  it.each([
    'artifacts/curriculum-cleanup-v1','artifacts/curriculum-cleanup-v1/snapshot.json',
    'artifacts/curriculum-cleanup-v1/cleanup-plan.json',
    'artifacts/g7-native-curriculum-v1','artifacts/g7-native-curriculum-v1/legacy',
    'artifacts/g7-native-curriculum-v1/legacy/literacy-essay-structure-argument.json',
    'artifacts/g7-native-curriculum-v1/legacy/math-number-sense-place-value.json',
    'scripts/patch-vitest-offline-wildcard.mjs','scripts/seed-demo.ts',
    'docs/governance/SECURITY_MODEL.md','lib/agents/prompts/ops-sentinel.md',
    'curriculum/program/stem-v1/resolved-days/g4-day1.json',
  ])('preserves %s including directory traversal used by the CLI',file=>expect(rules.ignores(file)).toBe(false));
});
