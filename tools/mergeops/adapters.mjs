import { isSha } from './core.mjs';

// Reports are data from a reviewed, isolated adapter executor. No dynamic plugin loading.
// Installation does not confer permission, authority, or trust in generated findings.
export function adapterReport(report, policy, expectedSha) {
  if (!['pstack', 'ponytail'].includes(report.adapter) || policy.adapters[report.adapter] !== true) throw Error('adapter-disabled');
  if (!isSha(report.head) || report.head !== expectedSha || !/^[a-f0-9]{64}$/.test(report.packageHash) ||
      !['correctness-security', 'maintainability'].includes(report.role) || !Number.isFinite(report.costUSD) || report.costUSD < 0 ||
      !Array.isArray(report.findings) || report.findings.length > 50 || report.findings.some(f => typeof f.path !== 'string' || typeof f.message !== 'string' || f.message.length > 2000)) throw Error('adapter-report-invalid');
  return { adapter: report.adapter, head: report.head, role: report.role, packageHash: report.packageHash, costUSD: report.costUSD,
    findings: report.findings, advisoryOnly: true };
}
