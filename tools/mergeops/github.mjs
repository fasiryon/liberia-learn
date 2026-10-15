import { createSign } from 'node:crypto';
import { isSha } from './core.mjs';

// App key stays in the trusted controller. Tokens are repository scoped and revoked in finally.
export async function installationClient({ appId, installationId, privateKey, repository, permissions, fetcher = fetch }) {
  if (!/^\d+$/.test(String(appId)) || !/^\d+$/.test(String(installationId))) throw Error('invalid-app-identity');
  const now = Math.floor(Date.now() / 1000);
  const part = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 30, exp: now + 300, iss: appId })}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
  const response = await fetcher(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST', headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ repositories: [repository.split('/')[1]], permissions }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`app-token:${response.status}`);
  const token = await response.json();
  const client = new GitHub(repository, token.token, fetcher);
  return { client, revoke: () => client.request('DELETE', '/installation/token', undefined, true) };
}
export class GitHub {
  constructor(repository, token, fetcher = fetch) {
    if (!/^[\w-]+\/[\w.-]+$/.test(repository)) throw Error('repository-invalid');
    this.repository = repository; this.token = token; this.fetcher = fetcher;
  }
  async request(method, path, body, global = false) {
    if (!path.startsWith('/') || path.includes('..') || path.includes('://')) throw Error('api-path-invalid');
    const response = await this.fetcher(`https://api.github.com${global ? '' : `/repos/${this.repository}`}${path}`, {
      method, headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw Object.assign(Error(`github:${method}:${response.status}`), { status: response.status });
    if (response.status === 204) return null;
    return response.json();
  }
  async pages(path, key) {
    const result = [];
    for (let page = 1; page <= 30; page++) {
      const data = await this.request('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const rows = key ? data[key] : data;
      if (!Array.isArray(rows)) throw Error('invalid-pagination');
      result.push(...rows);
      if (rows.length < 100) return result;
    }
    throw Error('pagination-limit');
  }
  async snapshot(number, policy) {
    if (!Number.isSafeInteger(number) || number < 1) throw Error('invalid-pr');
    const pr = await this.request('GET', `/pulls/${number}`);
    if (!isSha(pr.head.sha)) throw Error('invalid-sha');
    const [files, reviews, checks] = await Promise.all([
      this.pages(`/pulls/${number}/files`), this.pages(`/pulls/${number}/reviews`),
      this.pages(`/commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs'),
    ]);
    let protection = null;
    try { protection = await this.request('GET', `/branches/${encodeURIComponent(policy.base)}/protection`); }
    catch (error) { if (![403, 404].includes(error.status)) throw error; }
    const current = await this.request('GET', `/pulls/${number}`);
    let deploymentSuppressed = false;
    try {
      const config = JSON.parse(await this.text('vercel.json', pr.head.sha));
      // Merging must not implicitly deploy main. Unknown external integrations require operator review too.
      deploymentSuppressed = config.git?.deploymentEnabled === false;
    } catch { /* Missing or malformed deployment policy blocks merge. */ }
    return { pr: current, files, reviews, checks, protection,
      deploymentSuppressed,
      complete: pr.head.sha === current.head.sha && pr.base.sha === current.base.sha && files.length === current.changed_files && files.every(f => typeof f.patch === 'string') };
  }
  async text(path, ref, maxBytes = 100000) {
    if (!isSha(ref) || !/^[\w./-]+$/.test(path) || path.includes('..')) throw Error('invalid-content-ref');
    const item = await this.request('GET', `/contents/${path}?ref=${ref}`);
    if (item.type !== 'file' || item.encoding !== 'base64' || item.size > maxBytes) throw Error('unsupported-content');
    return Buffer.from(item.content, 'base64').toString('utf8');
  }
  async logs(jobId) {
    if (!Number.isSafeInteger(jobId)) throw Error('invalid-job');
    const r = await this.fetcher(`https://api.github.com/repos/${this.repository}/actions/jobs/${jobId}/logs`, {
      headers: { Authorization: `Bearer ${this.token}` }, redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (r.status !== 302) throw Error(`logs:${r.status}`);
    const location = new URL(r.headers.get('location'));
    if (location.protocol !== 'https:' || !location.hostname.endsWith('.blob.core.windows.net')) throw Error('logs-host');
    // Never forward installation credentials to the signed download URL.
    const download = await this.fetcher(location, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!download.ok) throw Error('logs-download');
    let total = 0; const chunks = [];
    for await (const chunk of download.body) {
      total += chunk.length;
      if (total > 8 * 1024 * 1024) throw Error('logs-size-limit');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async commitFiles(parent, files, message) {
    if (!isSha(parent)) throw Error('invalid-parent');
    const base = await this.request('GET', `/git/commits/${parent}`);
    const tree = [];
    for (const file of files) {
      const blob = await this.request('POST', '/git/blobs', { content: file.content, encoding: 'utf-8' });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const created = await this.request('POST', '/git/trees', { base_tree: base.tree.sha, tree });
    return this.request('POST', '/git/commits', { message, tree: created.sha, parents: [parent] });
  }
}
