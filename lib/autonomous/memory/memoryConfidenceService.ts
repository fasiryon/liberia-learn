export function scoreMemoryConfidence(input: { evidenceRefs?: any; lineage?: any; baseConfidence?: number | null }) {
  const refs = Array.isArray(input.evidenceRefs?.refs) ? input.evidenceRefs.refs : [];
  const lineageKeys = input.lineage ? Object.keys(input.lineage).length : 0;
  const evidenceScore = Math.min(1, refs.length / 3);
  const lineageScore = Math.min(1, lineageKeys / 3);
  const base = input.baseConfidence ?? 0.6;
  return Number(Math.max(0.05, Math.min(0.99, base * 0.4 + evidenceScore * 0.35 + lineageScore * 0.25)).toFixed(2));
}

