import { appendFileSync, existsSync, readFileSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { digest, redact } from './core.mjs';

export function seal(previous, event) {
  const record = { ...redact(event), version: 1, previous: previous ?? null };
  return { ...record, hash: digest(record) };
}
export function verify(records) {
  let previous = null;
  for (const { hash, ...record } of records) {
    if (record.previous !== previous || digest(record) !== hash) throw Error('ledger-integrity');
    previous = hash;
  }
  return records;
}
// Local replay ledger uses an exclusive writer lock and fsync. Never shared with PR code.
export class FileLedger {
  constructor(path) { this.path = path; }
  read() { return verify(existsSync(this.path) ? readFileSync(this.path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []); }
  async transact(event, decide = () => true) {
    const lock = openSync(`${this.path}.lock`, 'wx');
    try {
      const records = this.read();
      if (records.some(r => r.id === event.id)) return false;
      if (!decide(records)) throw Error('ledger-reservation-denied');
      const record = seal(records.at(-1)?.hash, event);
      appendFileSync(this.path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      const fd = openSync(this.path, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
      return true;
    } finally {
      closeSync(lock);
      // unlink only the lock created by this invocation.
      const { unlinkSync } = await import('node:fs'); unlinkSync(`${this.path}.lock`);
    }
  }
}
// One ledger per PR, backed by a separately protected Git branch. No force updates.
// A concurrent sibling commit is not a fast-forward and GitHub rejects it; caller retries by redelivery.
export class GitLedger {
  constructor(github, number) { this.github = github; this.ref = `mergeops-ledger/pr-${number}`; }
  async initialize() {
    try { await this.github.request('GET', `/git/ref/heads/${this.ref}`); return; }
    catch (e) { if (e.status !== 404) throw e; }
    // Orphan state branch contains no application, scripts or workflows and disables Git deployments.
    const tree = await this.github.request('POST', '/git/trees', { tree: [
      { path: 'ledger.jsonl', mode: '100644', type: 'blob', content: '' },
      { path: 'vercel.json', mode: '100644', type: 'blob', content: '{"git":{"deploymentEnabled":false}}\n' },
    ] });
    const commit = await this.github.request('POST', '/git/commits', { message: 'MergeOps: initialize mission ledger', tree: tree.sha, parents: [] });
    try { await this.github.request('POST', '/git/refs', { ref: `refs/heads/${this.ref}`, sha: commit.sha }); }
    catch (e) {
      if (e.status !== 422) throw e;
      // Concurrent initialization may win; verify the branch through the normal integrity path.
      await this.state();
    }
  }
  async state() {
    const ref = await this.github.request('GET', `/git/ref/heads/${this.ref}`);
    // Missing history is corruption, never an empty counter. Only initialize() creates an empty ledger.
    const data = await this.github.text('ledger.jsonl', ref.object.sha, 900000);
    const records = data.trim().split('\n').filter(Boolean).map(JSON.parse);
    return { sha: ref.object.sha, records: verify(records) };
  }
  async transact(event, decide = () => true) {
    const { sha, records } = await this.state();
    if (records.some(r => r.id === event.id)) return false;
    if (!decide(records)) throw Error('ledger-reservation-denied');
    records.push(seal(records.at(-1)?.hash, event));
    const commit = await this.github.commitFiles(sha, [{ path: 'ledger.jsonl', content: records.map(r => JSON.stringify(r)).join('\n') + '\n' }], 'MergeOps: append mission evidence');
    await this.github.request('PATCH', `/git/refs/heads/${this.ref}`, { sha: commit.sha, force: false });
    return true;
  }
}
