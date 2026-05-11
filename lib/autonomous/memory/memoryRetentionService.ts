export function defaultRetentionDays(scope: string) {
  if (scope === "national" || scope === "district") return 730;
  if (scope === "student") return 180;
  return 365;
}

export function retentionExpiresAt(input: { scope: string; retentionDays?: number; now?: Date }) {
  const now = input.now ?? new Date();
  return new Date(now.getTime() + (input.retentionDays ?? defaultRetentionDays(input.scope)) * 86_400_000);
}

export function isMemoryExpired(metadata: any, now = new Date()) {
  if (!metadata?.retention?.expiresAt) return false;
  return new Date(metadata.retention.expiresAt).getTime() <= now.getTime();
}

