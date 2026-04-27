export const SAFE_GROUNDING_THRESHOLD = 0.66;

// ─── AITrustSignal — sprint-level aggregate trust object ─────────────────────

export type AITrustSignal = {
  confidence: AiConfidence;
  groundingScore: number;
  fallbackUsed: boolean;
  retrievalUsed: boolean;
  citations: AiCitation[];
  warning?: string;
  generatedAt: string;
  model?: string;
  provider?: string;
  explainability?: AiExplainability;
};

export function buildTrustSignal(input: {
  groundingScore: number;
  hadFallback: boolean;
  retrievalUsed: boolean;
  role: TrustAudienceRole;
  sources?: string[];
  model?: string;
  provider?: string;
}): AITrustSignal {
  const { groundingScore, hadFallback, retrievalUsed, role, model, provider } = input;
  const sources = input.sources ?? [];
  const retrievalWeak = retrievalUsed && groundingScore < SAFE_GROUNDING_THRESHOLD;
  const confidence = deriveConfidence({ groundingScore, hadFallback, retrievalWeak });
  const explainability = buildExplainability({
    role,
    hadFallback,
    retrievalWeak,
    groundingScore,
    sources,
  });

  let warning: string | undefined;
  if (hadFallback) {
    warning = "Answer generated with limited context.";
  } else if (confidence === "low") {
    warning = "Limited curriculum grounding — ask your teacher to verify.";
  }

  return {
    confidence,
    groundingScore: roundScore(groundingScore),
    fallbackUsed: hadFallback,
    retrievalUsed,
    citations: [],
    warning,
    generatedAt: new Date().toISOString(),
    model,
    provider,
    explainability,
  };
}

export type AiConfidence = "high" | "medium" | "low";
export type CitationSourceType = "curriculum_content" | "policy" | "system";

export type CitationInput = {
  title: string;
  sourceLabel: string | null;
  sourceType: string;
  subject?: string | null;
  grade?: number | null;
  metadata?: unknown;
};

export type AiCitation = {
  sourceLabel: string;
  sourceType: CitationSourceType;
  title?: string;
  subject?: string | null;
  grade?: number | null;
  unit?: string | null;
};

export type AiExplainability = {
  reasoningSummary: string;
  sourcesUsed: string[];
  fallbackUsed: boolean;
};

type TrustAudienceRole =
  | "ADMIN"
  | "DISTRICT_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "GUARDIAN"
  | "MOE_OFFICIAL";

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(clampScore(value) * 100) / 100;
}

function normalizeSourceType(value: string): CitationSourceType {
  const lower = value.toLowerCase();
  if (lower.includes("policy") || lower.includes("governance")) {
    return "policy";
  }
  if (lower.includes("system") || lower.includes("adr") || lower.includes("architecture")) {
    return "system";
  }
  return "curriculum_content";
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function extractUnit(metadata: unknown): string | null {
  const record = metadataRecord(metadata);
  const unit =
    record.unit ??
    record.unitTitle ??
    record.unitName ??
    record.topic ??
    record.chapter;
  return typeof unit === "string" && unit.trim().length > 0 ? unit.trim() : null;
}

export function computeGroundingScore(similarities: number[]): number {
  if (similarities.length === 0) {
    return 0;
  }

  const score =
    similarities.reduce((sum, similarity) => sum + clampScore(similarity), 0) /
    similarities.length;
  return roundScore(score);
}

export function deriveConfidence(input: {
  groundingScore: number;
  hadFallback: boolean;
  retrievalWeak: boolean;
}): AiConfidence {
  if (
    input.hadFallback ||
    input.retrievalWeak ||
    input.groundingScore < SAFE_GROUNDING_THRESHOLD
  ) {
    return "low";
  }

  if (input.groundingScore >= 0.85) {
    return "high";
  }

  return "medium";
}

export function buildCitations(
  inputs: CitationInput[],
  role: TrustAudienceRole
): AiCitation[] {
  return inputs.map((input) => {
    const sourceType = normalizeSourceType(input.sourceType);
    if (role === "STUDENT" || role === "GUARDIAN") {
      return {
        sourceLabel:
          sourceType === "policy" ? "Based on school guidance" : "Based on this lesson",
        sourceType,
      };
    }

    return {
      sourceLabel: input.sourceLabel ?? input.title,
      sourceType,
      title: input.title,
      subject: input.subject ?? null,
      grade: input.grade ?? null,
      unit: extractUnit(input.metadata),
    };
  });
}

export function buildExplainability(input: {
  role: TrustAudienceRole;
  hadFallback: boolean;
  retrievalWeak: boolean;
  groundingScore: number;
  sources: string[];
}): AiExplainability | undefined {
  if (input.role !== "ADMIN" && input.role !== "TEACHER") {
    return undefined;
  }

  const reasoningSummary = input.hadFallback
    ? "The response fell back because the retrieved material was not strong enough for a grounded answer."
    : input.retrievalWeak
      ? "The response used retrieved material, but the supporting matches were weaker than the normal grounding threshold."
      : "The response was generated from retrieved curriculum or policy material that met the current grounding threshold.";

  return {
    reasoningSummary,
    sourcesUsed: input.sources,
    fallbackUsed: input.hadFallback,
  };
}
