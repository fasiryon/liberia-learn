import { logger } from "@/lib/logger";

export type SubjectConcurrencyProfile = {
  providerConcurrency: number;
  dbWriteConcurrency: number;
  batchSize: number;
  paused?: boolean;
};

export type SubjectRunStats = {
  attempted: number;
  failed: number;
  timeouts?: number;
  connectionResets?: number;
};

const DEFAULT_PROFILES: Record<string, SubjectConcurrencyProfile> = {
  ENGLISH: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 20 },
  LITERACY: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 20 },
  SCIENCE: { providerConcurrency: 1, dbWriteConcurrency: 1, batchSize: 5 },
  MATH: { providerConcurrency: 1, dbWriteConcurrency: 1, batchSize: 10 },
  SOCIAL_STUDIES: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 15 },
  CIVICS: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 15 },
  PE: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 20 },
};

function normalizeSubject(subject: string) {
  return subject.trim().toUpperCase().replace(/\s+/g, "_");
}

export function getSubjectConcurrencyProfile(subject: string): SubjectConcurrencyProfile {
  const profile = DEFAULT_PROFILES[normalizeSubject(subject)] ?? {
    providerConcurrency: 1,
    dbWriteConcurrency: 1,
    batchSize: 10,
  };
  return { ...profile };
}

export function adaptSubjectConcurrency(input: {
  subject: string;
  current: SubjectConcurrencyProfile;
  stats: SubjectRunStats;
}): SubjectConcurrencyProfile {
  const attempted = Math.max(0, input.stats.attempted);
  const errorRate = attempted > 0 ? input.stats.failed / attempted : 0;
  const instability = Boolean(input.stats.timeouts || input.stats.connectionResets);
  const next = { ...input.current };

  if (errorRate > 0.4) {
    next.paused = true;
    next.providerConcurrency = Math.min(next.providerConcurrency, 1);
    next.batchSize = Math.min(next.batchSize, 5);
  } else if (errorRate > 0.2) {
    next.providerConcurrency = Math.max(1, next.providerConcurrency - 1);
  }

  if (instability) {
    next.batchSize = Math.max(1, Math.floor(next.batchSize / 2));
    next.providerConcurrency = Math.max(1, Math.min(next.providerConcurrency, input.current.providerConcurrency));
  }

  if (
    next.paused !== input.current.paused ||
    next.providerConcurrency !== input.current.providerConcurrency ||
    next.dbWriteConcurrency !== input.current.dbWriteConcurrency ||
    next.batchSize !== input.current.batchSize
  ) {
    logger.warn("[CURRICULUM_REGEN] adaptive concurrency adjusted", {
      subject: normalizeSubject(input.subject),
      attempted,
      failed: input.stats.failed,
      errorRate,
      timeouts: input.stats.timeouts ?? 0,
      connectionResets: input.stats.connectionResets ?? 0,
      previous: input.current,
      next,
    });
  }

  return next;
}
