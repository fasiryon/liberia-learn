import { execFileSync } from 'node:child_process';
import { lstatSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isSha } from './core.mjs';

// Operator workstation only; never inside the App controller. Allowlisted read-only subcommands:
// nothing here fetches, prunes, deletes, checks out, resets or writes refs.
const readOnly = { worktree: ['list'], 'for-each-ref': null, status: null, 'merge-base': null, 'rev-list': null, diff: null, 'cat-file': ['-e'] };
// Flags are allowlisted, not denylisted: Git accepts unambiguous abbreviations (--outp means --output).
const allowedFlag = /^(?:--porcelain|--untracked-files=normal|--ignored=matching|--format=[^\n]*|--merged=[\w./-]+|--name-only|--count|--is-ancestor|-n|-e)$/;
export function git(cwd, args) {
  const [command, first] = args;
  if (!(command in readOnly) || (readOnly[command] && !readOnly[command].includes(first)) || args.some(a => a.startsWith('-') && !allowedFlag.test(a))) throw Error(`git-not-read-only:${command}`);
  // --no-optional-locks: status must not refresh another agent's index or take index.lock.
  return execFileSync('git', ['--no-optional-locks', '-C', cwd, '-c', 'core.fsmonitor=false', ...args], { encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
}
const has = (cwd, sha) => { try { git(cwd, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; } };
const lines = text => text.split('\n').map(l => l.trim()).filter(Boolean);

export function collectLocal(cwd, baseRef = 'origin/main') {
  const worktrees = [];
  for (const block of git(cwd, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/)) {
    const row = Object.fromEntries(lines(block).map(l => [l.split(' ')[0], l.slice(l.indexOf(' ') + 1)]));
    if (!row.worktree) continue;
    let dirty = null, localSecrets = 0;
    if (!('prunable' in row)) {
      try {
        dirty = lines(git(row.worktree, ['status', '--porcelain', '--untracked-files=normal'])).length;
        // Ignored local env files are unrecoverable if the worktree is removed.
        localSecrets = lines(git(row.worktree, ['status', '--porcelain', '--ignored=matching', '--untracked-files=normal'])).filter(l => /^!! (?:.*\/)?\.env[^/]*$/.test(l)).length;
      } catch { dirty = null; }
    }
    let modules = null;
    try { const p = join(row.worktree, 'node_modules'); modules = lstatSync(p).isSymbolicLink() ? { link: resolve(row.worktree, readlinkSync(p)) } : { dir: resolve(p) }; } catch { /* none */ }
    worktrees.push({ path: row.worktree, head: row.HEAD, branch: row.branch?.replace('refs/heads/', '') ?? null, detached: 'detached' in row, prunable: 'prunable' in row,
      locked: 'locked' in row, primary: !worktrees.length, dirty, localSecrets, modules });
  }
  // A worktree whose node_modules another worktree links to must stay until its dependents are gone.
  const norm = p => p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
  for (const w of worktrees) w.junctionTarget = Boolean(w.modules?.dir && worktrees.some(o => o !== w && o.modules?.link && norm(o.modules.link) === norm(w.modules.dir)));
  const branches = lines(git(cwd, ['for-each-ref', '--format=%(refname)%09%(objectname)%09%(committerdate:iso-strict)%09%(upstream:track)', 'refs/heads', 'refs/remotes/origin']))
    .map(l => l.split('\t')).filter(([ref]) => !ref.endsWith('/HEAD'))
    .map(([ref, sha, date, track]) => ({ ref: ref.replace(/^refs\/(?:heads|remotes)\//, ''), remote: ref.startsWith('refs/remotes/'), sha, committedAt: date, gone: track === '[gone]' }));
  const merged = lines(git(cwd, ['for-each-ref', `--merged=${baseRef}`, '--format=%(refname)', 'refs/heads', 'refs/remotes/origin'])).map(r => r.replace(/^refs\/(?:heads|remotes)\//, ''));
  return { baseRef, worktrees, branches, merged };
}
// Pairwise shared history and file overlap for open PR heads present locally.
export function relations(cwd, baseSha, prs) {
  const known = prs.filter(p => isSha(p.head.sha) && has(cwd, p.head.sha));
  const files = new Map(known.map(p => [p.number, new Set(lines(git(cwd, ['diff', '--name-only', `${git(cwd, ['merge-base', baseSha, p.head.sha]).trim()}`, p.head.sha])))]));
  const result = [];
  for (const [i, a] of known.entries()) for (const b of known.slice(i + 1)) {
    const shared = git(cwd, ['merge-base', a.head.sha, b.head.sha]).trim();
    const sharedCommits = Number(git(cwd, ['rev-list', '--count', `${baseSha}..${shared}`]).trim());
    result.push({ a: a.number, b: b.number, sharedCommits,
      uniqueA: Number(git(cwd, ['rev-list', '--count', `${shared}..${a.head.sha}`]).trim()),
      uniqueB: Number(git(cwd, ['rev-list', '--count', `${shared}..${b.head.sha}`]).trim()),
      overlappingFiles: [...files.get(a.number)].filter(f => files.get(b.number).has(f)).length });
  }
  return { relations: result, missing: prs.filter(p => !known.includes(p)).map(p => p.number) };
}
