// Usage is measured evidence from Vercel exports, never elapsed GitHub job time.
export function buildUsage(rows, month, limits) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw Error('invalid-month');
  const unique = new Map();
  for (const row of rows) {
    if (!row.id || !row.project || !/^[a-f0-9]{40}$/.test(row.sha) || !/^https:\/\/vercel\.com\//.test(row.evidenceUrl) || !Number.isFinite(Date.parse(row.createdAt))) throw Error('invalid-build-evidence');
    if (new Date(row.createdAt).toISOString().slice(0,7) !== month) continue;
    if (unique.has(row.id) && JSON.stringify(unique.get(row.id)) !== JSON.stringify(row)) throw Error('conflicting-build-evidence');
    unique.set(row.id, row);
  }
  const records = [...unique.values()];
  let cpuMinutes = 0, missingCpuMeasurements = 0;
  const attribution = {};
  for (const row of records) {
    if (row.cpuMinutes == null) { missingCpuMeasurements++; continue; }
    if (!Number.isFinite(row.cpuMinutes) || row.cpuMinutes < 0) throw Error('invalid-cpu-measurement');
    cpuMinutes += row.cpuMinutes;
    const key = `${row.project}:${row.pr ?? 'unattributed'}:${row.sha}`;
    attribution[key] = (attribution[key] ?? 0) + row.cpuMinutes;
  }
  const configured = Number.isFinite(limits.monthlyCpuMinutes) && limits.monthlyCpuMinutes > 0 && Number.isSafeInteger(limits.monthlyBuilds) && limits.monthlyBuilds > 0;
  const fraction = configured ? Math.max(cpuMinutes / limits.monthlyCpuMinutes, records.length / limits.monthlyBuilds) : null;
  return { month, builds: records.length, cpuMinutes, missingCpuMeasurements, attribution,
    alerts: configured ? limits.alertFractions.filter(n => fraction >= n).map(n => `budget-${Math.round(n * 100)}-percent`) : ['budget-unconfigured'],
    allowPreview: configured && missingCpuMeasurements === 0 && fraction < 1 };
}
export function previewDecision({ branch, environment, files, usage, approvedSha, head }) {
  if (environment !== 'preview') return { allow: false, reason: 'separate-deployment-authorization-required' };
  if (/^mergeops-(?:repair-|ledger[-/])/.test(branch) || branch === 'feat/mergeops-v1') return { allow: false, reason: 'engineering-automation' };
  if (!files.length || files.every(f => /^(?:docs\/|tools\/mergeops\/|__tests__\/|\.github\/)/.test(f))) return { allow: false, reason: 'no-preview-needed' };
  if (usage.allowPreview !== true || !/^[a-f0-9]{40}$/.test(head ?? '') || approvedSha !== head) return { allow: false, reason: 'budget-or-exact-head-approval' };
  return { allow: true, reason: 'approved-with-budget' };
}
