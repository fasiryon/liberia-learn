import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FileLedger } from './ledger.mjs';
import { lifecycle } from './controller.mjs';
import { decide } from './core.mjs';
import { fixtureRecipe } from './repair.mjs';

const policy = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/pr190.json', import.meta.url)));
const head = fixture.provenance.head;
const repo = { full_name: policy.repository };
const snapshot = { complete: true, pr: { number: 190, state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', user: { login: 'fasiryon' }, head: { sha: head, ref: 'fixture-replay', repo }, base: { sha: 'a1508ceaf7d89a338de624e9f63c9c4c592ca28c', ref: 'main', repo } },
  files: [{ filename: fixtureRecipe.testPath, status: 'modified', additions: 1, deletions: 1, patch: '+readFileSync("checked-in-fixture", "utf8")' }], reviews: [], checks: [], protection: null };
const output = resolve(process.argv[2] ?? 'artifacts/mergeops-replay'); mkdirSync(output, { recursive: true });
const ledger = new FileLedger(resolve(output, 'mission.jsonl'));
let externalWrites = 0;
const github = { snapshot: async () => structuredClone(snapshot), text: async path => path === fixtureRecipe.testPath ? fixture.test : fixture.source };
const writeTrap = { request: async () => { externalWrites++; throw Error('dry-run-write'); } };
const repair = await lifecycle({ github, ledger, number: 190, head, delivery: 'pr190-shallow-fixture-replay', policy, log: fixture.log, writer: writeTrap, merger: writeTrap });
const migration = structuredClone(snapshot);
migration.pr.number = 188;
migration.files = [{ filename: 'prisma/canonical/migrations/20261013_000001_content_bundle_scheduledwork_pins/migration.sql', patch: '+CREATE TABLE ContentBundleRecord();' }];
const report = { mode: 'offline-dry-run', provenance: fixture.provenance, scope: 'PR190 historical failure with isolated fixture-only diff; PR188 migration scenario. No claim that either full PR is low risk.',
  repair, migration: decide(migration, head, policy), externalWrites, ledgerEntries: ledger.read().length,
  proposalRecorded: ledger.read().some(r => r.type === 'repair-proposed'), autoMerge: policy.autoMerge, autoRepair: policy.autoRepair };
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
